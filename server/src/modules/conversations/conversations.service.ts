// src/modules/conversations/conversations.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationType, Prisma, RelationType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor';
import { toMessageView } from '../../common/utils/message-view';
import { canonicalDmKey } from '../../common/utils/dm-key';
import {
  AppEvent,
  ConversationCreatedPayload,
  MessageReadPayload,
  PresenceStatus,
} from '../../events/app-events';
import {
  ConversationView,
  DmConversationView,
  Paginated,
  PublicUserView,
} from '../../common/types/conversation-view';

/** Profile fields + username needed to build a PublicUser (docs/contract/_common.yaml). */
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
 * Everything the serializers need: the denormalized last message (+ attachments), the DM
 * participants (UserChat), the group with its member count, and read markers. `members`
 * and `reads` are fetched whole and filtered to the caller in the serializer — simpler
 * than caller-parameterized includes, and conversations have few participants.
 */
const conversationInclude = {
  lastMessage: { include: { attachments: true } },
  userChats: { include: { user: { select: userPublicSelect } } },
  group: { include: { _count: { select: { members: true } }, members: true } },
  reads: true,
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

/** Keyset cursor for the conversation list: order is (lastActivityAt desc, id desc). */
interface ListCursor {
  lastActivityAt: string;
  id: string;
}

/**
 * ConversationsService — the chat-session list and 1-on-1 DM lifecycle
 * (conversations.openapi.yaml): list (sorted by recent activity, with unread counts),
 * fetch one (membership-gated), open-or-create a DM (idempotent, contacts-only, block
 * guarded), and advance the durable read marker. Domain events are emitted only AFTER the
 * DB transaction commits (persist-then-broadcast, NF-16); RealtimeModule turns them into
 * `conversation:new` / `message:status` socket broadcasts.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly events: EventEmitter2,
  ) {}

  /** GET /conversations — the caller's conversations, most-recent first, keyset-paginated. */
  async list(
    callerId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<ConversationView>> {
    const after = decodeCursor<ListCursor>(cursor);
    const membership = this.membershipWhere(callerId);
    const where: Prisma.ConversationWhereInput = after
      ? { AND: [membership, this.keysetWhere(after)] }
      : membership;

    const rows = await this.prisma.conversation.findMany({
      where,
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: conversationInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = await Promise.all(page.map((row) => this.toView(callerId, row)));
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor<ListCursor>({ lastActivityAt: last.lastActivityAt.toISOString(), id: last.id })
        : null;

    return { data, nextCursor };
  }

  /**
   * GET /conversations/:conversationId — metadata for one conversation. Non-members get a
   * 404 (not 403) so existence is not leaked (conversations.openapi.yaml, NF-13).
   */
  async getOne(callerId: string, conversationId: string): Promise<ConversationView> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (!row || !this.isParticipant(callerId, row)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conversation not found' });
    }
    return this.toView(callerId, row);
  }

  /**
   * POST /conversations/dm — open or create the single DM with another user (FR-12).
   * Idempotent: returns the existing conversation (`created: false` → 200) or a newly
   * created one (`created: true` → 201). The pair must be contacts and not blocked in
   * either direction.
   */
  async openDm(
    callerId: string,
    otherUserId: string,
  ): Promise<{ conversation: DmConversationView; created: boolean }> {
    if (callerId === otherUserId) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot open a DM with yourself',
      });
    }

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
      select: { id: true },
    });
    if (!other) throw new NotFoundException({ code: 'NOT_FOUND', message: 'User not found' });

    if (!(await this.contacts.canInteract(callerId, otherUserId))) {
      throw new ForbiddenException({ code: 'BLOCKED', message: 'Interaction is blocked' });
    }
    if (!(await this.areFriends(callerId, otherUserId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You must be contacts to start a DM',
      });
    }

    const dmKey = canonicalDmKey(callerId, otherUserId);

    const existing = await this.findDmByKey(dmKey);
    if (existing) {
      return {
        conversation: (await this.toView(callerId, existing)) as DmConversationView,
        created: false,
      };
    }

    let created: ConversationRow;
    try {
      const convo = await this.prisma.$transaction(async (tx) => {
        const c = await tx.conversation.create({ data: { type: ConversationType.DM, dmKey } });
        await tx.userChat.createMany({
          data: [
            { userId: callerId, conversationId: c.id },
            { userId: otherUserId, conversationId: c.id },
          ],
        });
        return c;
      });
      created = (await this.findDmById(convo.id))!;
    } catch (e) {
      // Race on the unique dmKey: another request created the DM first — return it (200).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const raced = await this.findDmByKey(dmKey);
        if (raced) {
          return {
            conversation: (await this.toView(callerId, raced)) as DmConversationView,
            created: false,
          };
        }
      }
      throw e;
    }

    const view = (await this.toView(callerId, created)) as DmConversationView;
    // Committed above; now notify the other participant so the DM appears in their list.
    this.events.emit(AppEvent.ConversationCreated, {
      conversationId: created.id,
      recipientIds: [otherUserId],
    } satisfies ConversationCreatedPayload);
    return { conversation: view, created: true };
  }

  /**
   * POST /conversations/:conversationId/read — advance the caller's durable read marker
   * (FR-14). Persists the marker, then emits `message.read` so senders see "Read".
   */
  async markRead(
    callerId: string,
    conversationId: string,
    lastReadMessageId: string,
  ): Promise<void> {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: conversationInclude,
    });
    if (!row || !this.isParticipant(callerId, row)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conversation not found' });
    }

    const message = await this.prisma.message.findFirst({
      where: { id: lastReadMessageId, conversationId },
      select: { id: true },
    });
    if (!message) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Message not found in this conversation',
      });
    }

    await this.prisma.conversationRead.upsert({
      where: { userId_conversationId: { userId: callerId, conversationId } },
      create: { userId: callerId, conversationId, lastReadMessageId, lastReadAt: new Date() },
      update: { lastReadMessageId, lastReadAt: new Date() },
    });

    // Marker committed; notify senders over the socket.
    this.events.emit(AppEvent.MessageRead, {
      conversationId,
      lastReadMessageId,
      userId: callerId,
    } satisfies MessageReadPayload);
  }

  /**
   * Every conversation id the user participates in (DM via UserChat, group via Member).
   * Used by RealtimeGateway on connect to join the socket to each `conversation:<id>` room
   * so persist-then-broadcast emits (`message:new`, `message:deleted`, `message:status`)
   * reach them (asyncapi.yaml — the server joins conversation rooms on connect).
   */
  async listConversationIds(userId: string): Promise<string[]> {
    const rows = await this.prisma.conversation.findMany({
      where: this.membershipWhere(userId),
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // ── helpers ──────────────────────────────────────────────────────

  private membershipWhere(callerId: string): Prisma.ConversationWhereInput {
    return {
      OR: [
        { userChats: { some: { userId: callerId } } },
        { group: { members: { some: { userId: callerId } } } },
      ],
    };
  }

  private keysetWhere(after: ListCursor): Prisma.ConversationWhereInput {
    const at = new Date(after.lastActivityAt);
    return {
      OR: [{ lastActivityAt: { lt: at } }, { lastActivityAt: at, id: { lt: after.id } }],
    };
  }

  private isParticipant(callerId: string, row: ConversationRow): boolean {
    if (row.type === ConversationType.DM) {
      return row.userChats.some((uc) => uc.userId === callerId);
    }
    return row.group?.members.some((m) => m.userId === callerId) ?? false;
  }

  private findDmByKey(dmKey: string): Promise<ConversationRow | null> {
    return this.prisma.conversation.findUnique({ where: { dmKey }, include: conversationInclude });
  }

  private findDmById(id: string): Promise<ConversationRow | null> {
    return this.prisma.conversation.findUnique({ where: { id }, include: conversationInclude });
  }

  private areFriends(a: string, b: string): Promise<boolean> {
    return this.prisma.relation
      .findFirst({
        where: {
          type: RelationType.FRIEND,
          OR: [
            { ownerId: a, relatedId: b },
            { ownerId: b, relatedId: a },
          ],
        },
        select: { id: true },
      })
      .then((r) => r !== null);
  }

  private unreadCount(
    callerId: string,
    conversationId: string,
    lastReadMessageId: string | null,
  ): Promise<number> {
    return this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: callerId },
        deletedAt: null,
        ...(lastReadMessageId ? { id: { gt: lastReadMessageId } } : {}),
      },
    });
  }

  private async toView(callerId: string, row: ConversationRow): Promise<ConversationView> {
    const read = row.reads.find((r) => r.userId === callerId);
    const unreadCount = await this.unreadCount(callerId, row.id, read?.lastReadMessageId ?? null);
    const base = {
      id: row.id,
      lastMessage: row.lastMessage ? toMessageView(row.lastMessage) : null,
      lastActivityAt: row.lastActivityAt.toISOString(),
      unreadCount,
    };

    if (row.type === ConversationType.DM) {
      const other = row.userChats.find((uc) => uc.userId !== callerId)?.user;
      return { ...base, type: 'dm', otherUser: this.toPublicUser(other!) };
    }

    const myMember = row.group?.members.find((m) => m.userId === callerId);
    return {
      ...base,
      type: 'group',
      name: row.group!.name,
      avatarUrl: row.group!.avatarUrl,
      memberCount: row.group!._count.members,
      role: (myMember?.role ?? 'MEMBER').toLowerCase() as 'admin' | 'member',
    };
  }

  private toPublicUser(user: UserPublicRow): PublicUserView {
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
