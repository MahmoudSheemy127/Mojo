// src/modules/notifications/mentions.listener.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ConversationType, NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppEvent, MessageCreatedPayload } from '../../events/app-events';
import { NotificationsService } from './notifications.service';

/** Matches `@username` tokens (letters, digits, underscore) in message content. */
const MENTION_RE = /@([a-zA-Z0-9_]+)/g;

/** Just enough of a conversation to enumerate its participant user ids (DM + group). */
const participantsInclude = {
  userChats: { select: { userId: true } },
  group: { select: { members: { select: { userId: true } } } },
} satisfies Prisma.ConversationInclude;

/**
 * MentionsListener — turns `@username` mentions in a freshly-sent message into MENTION
 * notifications (FR-30, messages.md). It lives in NotificationsModule (not MessagesModule)
 * so the message-send path stays free of any NotificationsService dependency: MessagesService
 * just emits `message.created` after commit, and this listener reacts. Mentions are resolved
 * only against the conversation's own participants, so an `@name` of a non-member is ignored.
 * A failure here never affects message delivery — the durable `201` already happened.
 */
@Injectable()
export class MentionsListener {
  private readonly logger = new Logger(MentionsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(AppEvent.MessageCreated)
  async handle(payload: MessageCreatedPayload): Promise<void> {
    const { id: messageId, conversationId, senderId, content } = payload.message;
    if (!content) return;

    const handles = this.parseHandles(content);
    if (handles.length === 0) return;

    try {
      const recipientIds = await this.resolveParticipantIds(conversationId, handles, senderId);
      for (const recipientId of recipientIds) {
        await this.notifications.create({
          recipientId,
          type: NotificationType.MENTION,
          actorId: senderId,
          payload: { conversationId, messageId },
        });
      }
    } catch (err) {
      // Mention notifications are a best-effort side effect; never break delivery.
      this.logger.error(
        `Failed to create mention notifications for message ${messageId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /** Distinct lowercased `@username` handles found in the content. */
  private parseHandles(content: string): string[] {
    const handles = new Set<string>();
    for (const [, handle] of content.matchAll(MENTION_RE)) {
      handles.add(handle.toLowerCase());
    }
    return [...handles];
  }

  /**
   * Resolve the parsed handles to user ids, restricted to the conversation's participants and
   * excluding the sender. Username lives on `Account` (User↔Account 1:1), so we match there.
   */
  private async resolveParticipantIds(
    conversationId: string,
    handles: string[],
    senderId: string,
  ): Promise<string[]> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: participantsInclude,
    });
    if (!conversation) return [];

    const participantIds =
      conversation.type === ConversationType.DM
        ? conversation.userChats.map((uc) => uc.userId)
        : (conversation.group?.members.map((m) => m.userId) ?? []);
    const candidateIds = participantIds.filter((id) => id !== senderId);
    if (candidateIds.length === 0) return [];

    const accounts = await this.prisma.account.findMany({
      where: {
        userId: { in: candidateIds },
        username: { in: handles, mode: 'insensitive' },
      },
      select: { userId: true },
    });
    return accounts.map((a) => a.userId);
  }
}
