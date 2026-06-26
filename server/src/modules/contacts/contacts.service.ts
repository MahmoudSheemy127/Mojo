// src/modules/contacts/contacts.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { NotificationType, Prisma, RelationType, RequestStatus, RequestType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor';
import { PresenceStatus } from '../../events/app-events';
import { NotificationsService } from '@modules/notifications/notifications.service';

/** Contract shapes (docs/contract/_common.yaml). */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presence: PresenceStatus;
}

export interface ContactRequest {
  id: string;
  from: PublicUser;
  to: PublicUser;
  createdAt: string;
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

/** Keyset cursor for friend/blocked lists: paginate over the join row id. */
interface RelationCursor {
  id: string;
}

/** Pulls the profile fields + username needed to build a PublicUser. */
const userPublicSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  presence: true,
  account: { select: { username: true } },
} satisfies Prisma.UserSelect;

type UserPublicRow = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

/**
 * ContactsService — the friendship/contact graph (contacts.openapi.yaml): friend
 * requests, accept/decline, removal, and blocking. Friendship is a single directed
 * `Relation` row of type FRIEND read symmetrically; a block is a directed FRIEND-less
 * `Relation` of type BLOCK. `canInteract()` is the cross-cutting block guard reused
 * by search, DM creation, message send, and group invites (NF-13, contacts.md).
 */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService,
          private readonly notificationService: NotificationsService

  ) {}

  /** GET /contacts — the caller's accepted friends, keyset-paginated (FR-06). */
  async listFriends(
    callerId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<PublicUser>> {
    const after = decodeCursor<RelationCursor>(cursor);

    const relations = await this.prisma.relation.findMany({
      where: {
        type: RelationType.FRIEND,
        OR: [{ ownerId: callerId }, { relatedId: callerId }],
        ...(after ? { id: { gt: after.id } } : {}),
      },
      include: { owner: { select: userPublicSelect }, related: { select: userPublicSelect } },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const { page, nextCursor } = this.paginate(relations, limit);
    const data = page.map((r) =>
      this.toPublicUser(r.ownerId === callerId ? r.related : r.owner),
    );
    return { data, nextCursor };
  }

  /** GET /contacts/requests — pending friend requests, split by direction (FR-06). */
  async listRequests(
    callerId: string,
  ): Promise<{ incoming: ContactRequest[]; outgoing: ContactRequest[] }> {
    const requests = await this.prisma.request.findMany({
      where: {
        type: RequestType.FRIEND_REQUEST,
        status: RequestStatus.PENDING,
        OR: [{ targetUserId: callerId }, { sourceUserId: callerId }],
      },
      include: {
        sourceUser: { select: userPublicSelect },
        targetUser: { select: userPublicSelect },
      },
      orderBy: { createdAt: 'desc' },
    });

    const incoming: ContactRequest[] = [];
    const outgoing: ContactRequest[] = [];
    for (const r of requests) {
      const contactRequest = this.toContactRequest(r);
      if (r.targetUserId === callerId) incoming.push(contactRequest);
      else outgoing.push(contactRequest);
    }
    return { incoming, outgoing };
  }

  /**
   * POST /contacts/requests — send a friend request (FR-06). If the target already
   * sent the caller a pending request, the server auto-accepts (both become friends)
   * and returns that now-accepted request. Blocked either direction → 403 BLOCKED.
   */
  async sendRequest(callerId: string, targetUserId: string): Promise<ContactRequest> {
    if (callerId === targetUserId) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot send a friend request to yourself',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: userPublicSelect,
    });
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

    if (await this.isBlockedEitherWay(callerId, targetUserId)) {
      throw new ForbiddenException({ code: 'BLOCKED', message: 'Interaction is blocked' });
    }

    if (await this.findFriendship(callerId, targetUserId)) {
      throw new ConflictException({ code: 'ALREADY_FRIENDS', message: 'Already friends' });
    }

    // Mutual request → auto-accept: mark the reverse request accepted + create the edge.
    const reverse = await this.prisma.request.findFirst({
      where: {
        type: RequestType.FRIEND_REQUEST,
        status: RequestStatus.PENDING,
        sourceUserId: targetUserId,
        targetUserId: callerId,
      },
      include: {
        sourceUser: { select: userPublicSelect },
        targetUser: { select: userPublicSelect },
      },
    });
    if (reverse) {
      await this.prisma.$transaction(async (tx) => {
        await tx.request.update({
          where: { id: reverse.id },
          data: { status: RequestStatus.ACCEPTED, respondedAt: new Date() },
        });
        await tx.relation.create({
          data: { ownerId: callerId, relatedId: targetUserId, type: RelationType.FRIEND },
        });
      });
      // Notify the original requester that the caller accepted (informational; actor profile
      // resolved from actorId, so no extra FE fetch).
      await this.notificationService.create({
        recipientId: reverse.sourceUserId,
        type: NotificationType.FRIEND_REQUEST_ACCEPTED,
        actorId: callerId,
      });
      // ContactRequest carries no status field; the reverse request's identity/users
      // are what the FE needs to reconcile the now-accepted friendship.
      return this.toContactRequest(reverse);
    }

    const existing = await this.prisma.request.findFirst({
      where: {
        type: RequestType.FRIEND_REQUEST,
        status: RequestStatus.PENDING,
        sourceUserId: callerId,
        targetUserId,
      },
    });
    if (existing) {
      throw new ConflictException({ code: 'REQUEST_EXISTS', message: 'Request already pending' });
    }

    const created = await this.prisma.request.create({
      data: { sourceUserId: callerId, targetUserId, type: RequestType.FRIEND_REQUEST },
      include: {
        sourceUser: { select: userPublicSelect },
        targetUser: { select: userPublicSelect },
      },
    });

    // Side effect: notify the target. The actor (caller) profile is resolved server-side
    // from actorId by the serializer, so the FE renders it without an extra fetch; payload
    // only carries the requestId the FE needs to accept/decline.
    await this.notificationService.create({
      recipientId: targetUserId,
      type: NotificationType.FRIEND_REQUEST,
      actorId: callerId,
      requestId: created.id,
    });

    return this.toContactRequest(created);
  }

  /** POST /contacts/requests/:id/accept — accept a pending request (FR-06). */
  async acceptRequest(callerId: string, requestId: string): Promise<{ friend: PublicUser }> {
    const request = await this.prisma.request.findUnique({
      where: { id: requestId },
      include: { sourceUser: { select: userPublicSelect } },
    });
    if (
      !request ||
      request.type !== RequestType.FRIEND_REQUEST ||
      request.status !== RequestStatus.PENDING
    ) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found' });
    }
    if (request.targetUserId !== callerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not the recipient of this request',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.request.update({
        where: { id: requestId },
        data: { status: RequestStatus.ACCEPTED, respondedAt: new Date() },
      });
      const already = await tx.relation.findFirst({
        where: {
          type: RelationType.FRIEND,
          OR: [
            { ownerId: request.sourceUserId, relatedId: callerId },
            { ownerId: callerId, relatedId: request.sourceUserId },
          ],
        },
      });
      if (!already) {
        await tx.relation.create({
          data: {
            ownerId: request.sourceUserId,
            relatedId: callerId,
            type: RelationType.FRIEND,
          },
        });
      }
    });

    // Notify the original requester that the caller accepted (informational; actor profile
    // resolved from actorId, so no extra FE fetch).
    await this.notificationService.create({
      recipientId: request.sourceUserId,
      type: NotificationType.FRIEND_REQUEST_ACCEPTED,
      actorId: callerId,
    });

    return { friend: this.toPublicUser(request.sourceUser) };
  }

  /** POST /contacts/requests/:id/decline — remove a pending request (FR-06). */
  async declineRequest(callerId: string, requestId: string): Promise<void> {
    const request = await this.prisma.request.findUnique({ where: { id: requestId } });
    if (
      !request ||
      request.type !== RequestType.FRIEND_REQUEST ||
      request.status !== RequestStatus.PENDING
    ) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Request not found' });
    }
    if (request.targetUserId !== callerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not the recipient of this request',
      });
    }
    await this.prisma.request.delete({ where: { id: requestId } });
  }

  /** DELETE /contacts/:userId — remove a friendship symmetrically (FR-07). */
  async removeContact(callerId: string, userId: string): Promise<void> {
    const friendship = await this.findFriendship(callerId, userId);
    if (!friendship) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not a contact' });
    await this.prisma.relation.delete({ where: { id: friendship.id } });
  }

  /**
   * POST /contacts/blocks — block a user (FR-08). Creates the block edge and, in the
   * same transaction, drops any friendship and pending requests between the pair so
   * the block is server-enforced (NF-13).
   */
  async blockUser(callerId: string, userId: string): Promise<{ blockedUser: PublicUser }> {
    if (callerId === userId) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot block yourself',
      });
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userPublicSelect,
    });
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

    const existing = await this.prisma.relation.findUnique({
      where: {
        ownerId_relatedId_type: {
          ownerId: callerId,
          relatedId: userId,
          type: RelationType.BLOCK,
        },
      },
    });
    if (existing) {
      throw new ConflictException({ code: 'ALREADY_BLOCKED', message: 'User already blocked' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.relation.create({
        data: { ownerId: callerId, relatedId: userId, type: RelationType.BLOCK },
      });
      await tx.relation.deleteMany({
        where: {
          type: RelationType.FRIEND,
          OR: [
            { ownerId: callerId, relatedId: userId },
            { ownerId: userId, relatedId: callerId },
          ],
        },
      });
      await tx.request.deleteMany({
        where: {
          type: RequestType.FRIEND_REQUEST,
          status: RequestStatus.PENDING,
          OR: [
            { sourceUserId: callerId, targetUserId: userId },
            { sourceUserId: userId, targetUserId: callerId },
          ],
        },
      });
    });

    return { blockedUser: this.toPublicUser(target) };
  }

  /** GET /contacts/blocked — the caller's blocked users, keyset-paginated (FR-09). */
  async listBlocked(
    callerId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<PublicUser>> {
    const after = decodeCursor<RelationCursor>(cursor);

    const relations = await this.prisma.relation.findMany({
      where: {
        type: RelationType.BLOCK,
        ownerId: callerId,
        ...(after ? { id: { gt: after.id } } : {}),
      },
      include: { related: { select: userPublicSelect } },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const { page, nextCursor } = this.paginate(relations, limit);
    const data = page.map((r) => this.toPublicUser(r.related));
    return { data, nextCursor };
  }

  /** DELETE /contacts/blocks/:userId — remove a block; no friendship is restored (FR-09). */
  async unblockUser(callerId: string, userId: string): Promise<void> {
    const block = await this.prisma.relation.findUnique({
      where: {
        ownerId_relatedId_type: {
          ownerId: callerId,
          relatedId: userId,
          type: RelationType.BLOCK,
        },
      },
    });
    if (!block) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User is not blocked' });
    await this.prisma.relation.delete({ where: { id: block.id } });
  }

  /**
   * Cross-cutting block guard (NF-13, contacts.md). Returns false when a BLOCK exists
   * in either direction between the two users. Reused by search, DM creation, message
   * send, and group invites.
   */
  async canInteract(a: string, b: string): Promise<boolean> {
    return !(await this.isBlockedEitherWay(a, b));
  }

  /**
   * Whether two users are contacts (a single symmetric FRIEND edge exists, in either
   * stored ordering). Reused by GroupsService to enforce "members must be the caller's
   * contacts" on group creation / member-add (groups.md).
   */
  async areFriends(a: string, b: string): Promise<boolean> {
    return (await this.findFriendship(a, b)) !== null;
  }

  // ── helpers ──────────────────────────────────────────────────────

  /** The single FRIEND edge between two users, in either stored ordering, or null. */
  private findFriendship(a: string, b: string) {
    return this.prisma.relation.findFirst({
      where: {
        type: RelationType.FRIEND,
        OR: [
          { ownerId: a, relatedId: b },
          { ownerId: b, relatedId: a },
        ],
      },
    });
  }

  private async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const block = await this.prisma.relation.findFirst({
      where: {
        type: RelationType.BLOCK,
        OR: [
          { ownerId: a, relatedId: b },
          { ownerId: b, relatedId: a },
        ],
      },
    });
    return block !== null;
  }

  /** Take `limit + 1` rows; trim to `limit` and derive the keyset cursor of the last. */
  private paginate<T extends { id: string }>(
    rows: T[],
    limit: number,
  ): { page: T[]; nextCursor: string | null } {
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? encodeCursor<RelationCursor>({ id: last.id }) : null;
    return { page, nextCursor };
  }

  private toContactRequest(request: {
    id: string;
    createdAt: Date;
    sourceUser: UserPublicRow;
    targetUser: UserPublicRow;
  }): ContactRequest {
    return {
      id: request.id,
      from: this.toPublicUser(request.sourceUser),
      to: this.toPublicUser(request.targetUser),
      createdAt: request.createdAt.toISOString(),
    };
  }

  private toPublicUser(user: UserPublicRow): PublicUser {
    return {
      id: user.id,
      username: user.account?.username ?? '',
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      presence: user.presence.toLowerCase() as PresenceStatus,
    };
  }
}
