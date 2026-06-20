// src/modules/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, RelationType, RequestType, RequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { encodeCursor, decodeCursor } from '../../common/utils/cursor';
import { AppEvent, PresenceChangedPayload, PresenceStatus } from '../../events/app-events';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** Contract shapes (docs/contract/_common.yaml). */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presence: PresenceStatus;
}

export interface SelfUser extends PublicUser {
  email: string;
  createdAt: string;
}

/** Relationship of a search result to the caller (drives the FE row action). */
export type Relationship =
  | 'none'
  | 'request_sent'
  | 'request_received'
  | 'friends'
  | 'blocked'
  | 'blocked_by';

export interface UserSearchResult {
  user: PublicUser;
  relationship: Relationship;
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

/** The uploaded-file shape we rely on (a subset of Express.Multer.File). */
export interface UploadedAvatar {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Keyset cursor for user search: username is the order key, id breaks ties. */
interface SearchCursor {
  username: string;
  id: string;
}

const userProfileSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  presence: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** GET /users/me — the authenticated user's full profile. */
  async getMe(userId: string): Promise<SelfUser> {
    const account = await this.prisma.account.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!account) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    return this.toSelfUser(account.user, account);
  }

  /** PATCH /users/me — update displayName/bio (FR-11). */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SelfUser> {
    const data: Prisma.UserUpdateInput = {};
    if (dto.displayName !== undefined) data.displayName = dto.displayName;
    if (dto.bio !== undefined) data.bio = dto.bio; // null clears it

    await this.prisma.user.update({ where: { id: userId }, data });
    return this.getMe(userId);
  }

  /**
   * PUT /users/me/avatar — validate and store the image, set the URL (FR-11).
   * Storage is local for now (object storage is a P3 dependency); the contract
   * shape `{ avatarUrl }` is stable regardless of backend.
   */
  async setAvatar(userId: string, file: UploadedAvatar | undefined): Promise<{ avatarUrl: string }> {
    if (!file) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'No file uploaded',
      });
    }
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Unsupported image type',
      });
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new PayloadTooLargeException({
        code: 'FILE_TOO_LARGE',
        message: 'Avatar exceeds the maximum allowed size',
      });
    }

    const avatarUrl = await this.storeAvatar(userId, file);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return { avatarUrl };
  }

  /** DELETE /users/me/avatar — revert to the initials fallback (FR-11). */
  async deleteAvatar(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
  }

  /**
   * PATCH /users/me/presence — persist the explicit Away/DnD/Online choice (FR-10),
   * then emit `presence.changed` AFTER the write commits (persist-then-broadcast,
   * NF-16). The RealtimeModule listener fans it out to the user's contacts.
   */
  async setPresence(userId: string, status: 'online' | 'away' | 'offline'): Promise<{ presence: PresenceStatus }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { presence: status.toUpperCase() as Prisma.UserUpdateInput['presence'] },
    });

    const payload: PresenceChangedPayload = { userId, status };


    this.events.emit(AppEvent.PresenceChanged, payload);
    return { presence: status };
  }

  /**
   * GET /users/search — case-insensitive partial username match (FR-05). Excludes
   * the caller and anyone in a block relationship either direction (FR-08), and
   * tags each row with the caller's relationship to it. Keyset-paginated by
   * (username, id).
   */
  async search(
    callerId: string,
    q: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<UserSearchResult>> {
    const blockedIds = await this.blockedUserIds(callerId);
    const after = decodeCursor<SearchCursor>(cursor);

    const accounts = await this.prisma.account.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        userId: { notIn: [callerId, ...blockedIds] },
        ...(after
          ? {
              OR: [
                { username: { gt: after.username } },
                { AND: [{ username: after.username }, { id: { gt: after.id } }] },
              ],
            }
          : {}),
      },
      include: { user: { select: userProfileSelect } },
      orderBy: [{ username: 'asc' }, { id: 'asc' }],
      take: limit + 1, // fetch one extra to know whether another page exists
    });

    const hasMore = accounts.length > limit;
    const page = hasMore ? accounts.slice(0, limit) : accounts;

    const relationships = await this.relationshipsFor(
      callerId,
      page.map((a) => a.userId),
    );

    const data: UserSearchResult[] = page.map((a) => ({
      user: this.toPublicUser(a.user, a.username),
      relationship: relationships.get(a.userId) ?? 'none',
    }));

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor<SearchCursor>({ username: last.username, id: last.id }) : null;

    return { data, nextCursor };
  }

  /**
   * GET /users/:userId — public profile. Returns 404 when the user does not exist
   * OR is in a block relationship with the caller (default policy: hide existence
   * rather than leak it, users.md).
   */
  async getPublic(callerId: string, userId: string): Promise<PublicUser> {
    const account = await this.prisma.account.findUnique({
      where: { userId },
      include: { user: { select: userProfileSelect } },
    });
    if (!account) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

    if (userId !== callerId) {
      const blocked = await this.prisma.relation.findFirst({
        where: {
          type: RelationType.BLOCK,
          OR: [
            { ownerId: callerId, relatedId: userId },
            { ownerId: userId, relatedId: callerId },
          ],
        },
      });
      if (blocked) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });
    }

    return this.toPublicUser(account.user, account.username);
  }

  // ── helpers ──────────────────────────────────────────────────────

  /** Ids of users in a BLOCK relationship with the caller, either direction. */
  private async blockedUserIds(callerId: string): Promise<string[]> {
    const relations = await this.prisma.relation.findMany({
      where: {
        type: RelationType.BLOCK,
        OR: [{ ownerId: callerId }, { relatedId: callerId }],
      },
      select: { ownerId: true, relatedId: true },
    });
    const ids = new Set<string>();
    for (const r of relations) {
      ids.add(r.ownerId === callerId ? r.relatedId : r.ownerId);
    }
    return [...ids];
  }

  /**
   * Compute the caller's relationship to each of `targetIds` in batch (avoids N+1):
   * friends > request_sent > request_received > none. Block states are not produced
   * here — blocked users are already excluded from search results.
   */
  private async relationshipsFor(
    callerId: string,
    targetIds: string[],
  ): Promise<Map<string, Relationship>> {
    const result = new Map<string, Relationship>();
    if (targetIds.length === 0) return result;

    const [friends, requests] = await Promise.all([
      this.prisma.relation.findMany({
        where: {
          type: RelationType.FRIEND,
          OR: [
            { ownerId: callerId, relatedId: { in: targetIds } },
            { relatedId: callerId, ownerId: { in: targetIds } },
          ],
        },
        select: { ownerId: true, relatedId: true },
      }),
      this.prisma.request.findMany({
        where: {
          type: RequestType.FRIEND_REQUEST,
          status: RequestStatus.PENDING,
          OR: [
            { sourceUserId: callerId, targetUserId: { in: targetIds } },
            { targetUserId: callerId, sourceUserId: { in: targetIds } },
          ],
        },
        select: { sourceUserId: true, targetUserId: true },
      }),
    ]);

    for (const f of friends) {
      const other = f.ownerId === callerId ? f.relatedId : f.ownerId;
      result.set(other, 'friends');
    }
    for (const r of requests) {
      const isSender = r.sourceUserId === callerId;
      const other = isSender ? r.targetUserId : r.sourceUserId;
      if (result.get(other) === 'friends') continue; // friendship wins
      result.set(other, isSender ? 'request_sent' : 'request_received');
    }
    return result;
  }

  /**
   * Persist the avatar bytes to local disk and return its public URL. Replaceable
   * by an S3/R2 uploader later without changing the contract.
   */
  private async storeAvatar(userId: string, file: UploadedAvatar): Promise<string> {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const ext = extensionForMime(file.mimetype);
    const dir = join(process.cwd(), 'uploads', 'avatars');
    await mkdir(dir, { recursive: true });
    const fileName = `${userId}-${Date.now()}${ext}`;
    await writeFile(join(dir, fileName), file.buffer);
    return `/uploads/avatars/${fileName}`;
  }

  private toPublicUser(
    user: { id: string; displayName: string; avatarUrl: string | null; bio: string | null; presence: string },
    username: string,
  ): PublicUser {
    return {
      id: user.id,
      username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      presence: user.presence.toLowerCase() as PresenceStatus,
    };
  }

  private toSelfUser(
    user: {
      id: string;
      displayName: string;
      avatarUrl: string | null;
      bio: string | null;
      presence: string;
      createdAt: Date;
    },
    account: { username: string; email: string },
  ): SelfUser {
    return {
      ...this.toPublicUser(user, account.username),
      email: account.email,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

function extensionForMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '';
  }
}
