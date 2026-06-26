// src/modules/messages/messages.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor';
import { newUlid } from '../../common/utils/ulid';
import { toMessageView } from '../../common/utils/message-view';
import { MessageView, Paginated } from '../../common/types/conversation-view';
import {
  AppEvent,
  MessageCreatedPayload,
  MessageDeletedPayload,
} from '../../events/app-events';

/** Just enough of a conversation to authorize the caller (DM via UserChat, group via Member). */
const participantsInclude = {
  userChats: { select: { userId: true } },
  group: { select: { members: { select: { userId: true } } } },
} satisfies Prisma.ConversationInclude;

type ConversationParticipants = Prisma.ConversationGetPayload<{
  include: typeof participantsInclude;
}>;

/** Keyset cursor for history: the ULID id of the oldest message in the page just returned. */
interface HistoryCursor {
  id: string;
}

/** The send response is the contract Message plus the echoed clientNonce (for FE reconcile). */
export type SentMessage = MessageView & { clientNonce?: string };

export interface SendMessageInput {
  content?: string | null;
  attachmentIds?: string[];
  clientNonce?: string;
}

/**
 * MessagesService — message history, sending, and soft-delete (messages.openapi.yaml).
 * The send path is the canonical persist-then-broadcast (NF-16): the row is committed
 * inside a transaction and the durable `201` is the ack; only AFTER commit is
 * `message.created` emitted, which RealtimeModule turns into the `message:new` broadcast.
 * Every endpoint is membership-gated (non-participants get 404 — no existence leak, NF-13);
 * DM sends additionally pass the cross-cutting block guard (403 BLOCKED).
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * GET /conversations/:conversationId/messages — one page of history, paginating BACKWARD
   * in time. `data` is ordered oldest→newest within the page; `nextCursor` points to the
   * next older page (null at the start of history). Soft-deleted messages are included
   * (content null, deletedAt set) so the FE renders the placeholder (FR-13/FR-16).
   */
  async list(
    callerId: string,
    conversationId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<MessageView>> {
    await this.assertParticipant(callerId, conversationId);

    const after = decodeCursor<HistoryCursor>(cursor);
    const rows = await this.prisma.message.findMany({
      where: { conversationId, ...(after ? { id: { lt: after.id } } : {}) },
      orderBy: { id: 'desc' }, // newest first for the keyset, then reversed for the response
      take: limit + 1,
      include: { attachments: true },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const oldest = page[page.length - 1];
    const nextCursor =
      hasMore && oldest ? encodeCursor<HistoryCursor>({ id: oldest.id }) : null;

    // Stored desc (newest→oldest); the contract returns each page oldest→newest.
    const data = page
      .slice()
      .reverse()
      .map((m) => toMessageView(m));

    return { data, nextCursor };
  }

  /**
   * POST /conversations/:conversationId/messages — persist, then emit (FR-13, NF-16).
   * Server assigns the ULID id/createdAt; `@mentions` notification side-effects are wired
   * in NotificationsModule. Returns the persisted Message (the durable ack) with the
   * caller's clientNonce echoed back.
   */
  async send(
    callerId: string,
    conversationId: string,
    input: SendMessageInput,
  ): Promise<SentMessage> {
    const conversation = await this.assertParticipant(callerId, conversationId);
    await this.assertNotBlocked(callerId, conversation);

    const id = newUlid();
    const attachmentIds = input.attachmentIds ?? [];

    // Commit first (NF-16): create the row, attach any uploads, bump the list preview.
    const persisted = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { id, conversationId, senderId: callerId, content: input.content ?? null },
      });
      if (attachmentIds.length > 0) {
        // Only the caller's own, not-yet-attached uploads are linked; others are ignored.
        await tx.attachment.updateMany({
          where: { id: { in: attachmentIds }, uploaderId: callerId, messageId: null },
          data: { messageId: id },
        });
      }
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageId: id, lastActivityAt: created.createdAt },
      });
      return tx.message.findUniqueOrThrow({
        where: { id },
        include: { attachments: true },
      });
    });

    const view = toMessageView(persisted);
    // Persisted above; broadcast only now (the listener emits `message:new` to the room).
    this.events.emit(AppEvent.MessageCreated, {
      conversationId,
      message: view,
    } satisfies MessageCreatedPayload);

    return { ...view, clientNonce: input.clientNonce };
  }

  /**
   * DELETE /messages/:messageId — soft-delete (FR-16). Only the sender may delete. Sets
   * deletedAt, nulls content, and drops attachments; the row remains so the placeholder
   * renders for everyone. Persist, then emit `message.deleted`.
   */
  async softDelete(callerId: string, messageId: string): Promise<void> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, senderId: true },
    });
    if (!message) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Message not found' });
    }
    if (message.senderId !== callerId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only the sender may delete this message',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.attachment.deleteMany({ where: { messageId } });
      await tx.message.update({
        where: { id: messageId },
        data: { content: null, deletedAt: new Date() },
      });
    });

    this.events.emit(AppEvent.MessageDeleted, {
      conversationId: message.conversationId,
      messageId,
    } satisfies MessageDeletedPayload);
  }

  // ── helpers ──────────────────────────────────────────────────────

  /**
   * Load the conversation and assert the caller participates. Non-members (and unknown
   * ids) get a 404 so conversation existence is not leaked (NF-13, matches Conversations).
   */
  private async assertParticipant(
    callerId: string,
    conversationId: string,
  ): Promise<ConversationParticipants> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: participantsInclude,
    });
    if (!conversation || !this.isParticipant(callerId, conversation)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Conversation not found' });
    }
    return conversation;
  }

  private isParticipant(callerId: string, conversation: ConversationParticipants): boolean {
    if (conversation.type === ConversationType.DM) {
      return conversation.userChats.some((uc) => uc.userId === callerId);
    }
    return conversation.group?.members.some((m) => m.userId === callerId) ?? false;
  }

  /** In a DM, sending is refused (403 BLOCKED) if either user has blocked the other. */
  private async assertNotBlocked(
    callerId: string,
    conversation: ConversationParticipants,
  ): Promise<void> {
    if (conversation.type !== ConversationType.DM) return;
    const other = conversation.userChats.find((uc) => uc.userId !== callerId)?.userId;
    if (other && !(await this.contacts.canInteract(callerId, other))) {
      throw new ForbiddenException({ code: 'BLOCKED', message: 'Interaction is blocked' });
    }
  }
}
