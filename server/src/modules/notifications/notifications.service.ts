// src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor';
import { AppEvent, NotificationCreatedPayload } from '../../events/app-events';
import { Paginated } from '../../common/types/conversation-view';
import { NotificationView } from '../../common/types/notification-view';
import {
  NotificationRow,
  notificationInclude,
  toNotificationView,
} from './notification-serializer';

/** Keyset cursor for the feed: order is (createdAt desc, id desc). */
interface ListCursor {
  createdAt: string;
  id: string;
}

/** What a side-effecting caller (contacts / groups / messages) supplies to create one. */
export interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  /** Who triggered it; null/omitted for system notifications. */
  actorId?: string | null;
  /** Set only for request-backed notifications (friend/group/join requests). */
  requestId?: string | null;
  /** Mention target ids, generic text, etc. (docs/contract/_common.yaml#NotificationPayload). */
  payload?: Prisma.InputJsonValue;
}

/**
 * NotificationsService — the notification feed (notifications.openapi.yaml): the
 * keyset-paginated list (newest first), the unseen count that drives the bell badge, and the
 * mark-seen call that clears it. It also owns notification *creation* as a side effect of
 * other domains (friend request → FRIEND_REQUEST, mention → MENTION, group invite →
 * GROUP_INVITE): callers invoke `create()`, which persists first and only then emits
 * `notification.created` (persist-then-broadcast, NF-16) for RealtimeModule to turn into a
 * `notification:new` socket push. Message notifications are intentionally NOT in this feed —
 * they are per-conversation unread badges.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /** GET /notifications — the caller's notifications, newest first, keyset-paginated. */
  async list(
    recipientId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<NotificationView>> {
    const after = decodeCursor<ListCursor>(cursor);
    const where: Prisma.NotificationWhereInput = after
      ? { recipientId, ...this.keysetWhere(after) }
      : { recipientId };

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: notificationInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = page.map(toNotificationView);
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor<ListCursor>({ createdAt: last.createdAt.toISOString(), id: last.id })
        : null;

    return { data, nextCursor };
  }

  /** GET /notifications/count — number of unseen notifications (drives the bell badge). */
  async count(recipientId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({
      where: { recipientId, read: false },
    });
    return { count };
  }

  /**
   * POST /notifications/seen — mark the caller's unseen notifications seen. With `ids`, only
   * those are marked; otherwise all unseen. Scoped to the caller so one user can never flip
   * another's notifications. Seen ≠ resolved — actionable items stay actionable.
   */
  async markSeen(recipientId: string, ids?: string[]): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        recipientId,
        read: false,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { read: true },
    });
  }

  /**
   * Create a notification as a side effect of another action, then emit `notification.created`
   * for the realtime layer. Persist-then-broadcast (NF-16): the row is committed before the
   * event fires. Returns the serialized view the emit also carries.
   */
  async create(input: CreateNotificationInput): Promise<NotificationView> {
    const row: NotificationRow = await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        actorId: input.actorId ?? null,
        requestId: input.requestId ?? null,
        payload: input.payload ?? Prisma.JsonNull,
      },
      include: notificationInclude,
    });

    const notification = toNotificationView(row);
    this.events.emit(AppEvent.NotificationCreated, {
      recipientId: input.recipientId,
      notification,
    } satisfies NotificationCreatedPayload);
    return notification;
  }

  // ── helpers ──────────────────────────────────────────────────────

  private keysetWhere(after: ListCursor): Prisma.NotificationWhereInput {
    const at = new Date(after.createdAt);
    return {
      OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: after.id } }],
    };
  }
}
