// src/modules/notifications/notification-serializer.ts
// Shared Prisma select + contract serializer for the Notifications domain, so every surface
// (the REST feed and the `notification:new` socket emit) produces the exact same
// Notification shape (docs/contract/_common.yaml#Notification).
import { Prisma } from '@prisma/client';
import { PresenceStatus } from '../../events/app-events';
import { PublicUserView } from '../../common/types/conversation-view';
import {
  NotificationPayloadView,
  NotificationTypeView,
  NotificationView,
} from '../../common/types/notification-view';

/** Profile fields + username needed to build the actor's PublicUser. */
const actorPublicSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  presence: true,
  account: { select: { username: true } },
} satisfies Prisma.UserSelect;

/** A Notification row with its actor populated — the input the serializer needs. */
export const notificationInclude = {
  actor: { select: actorPublicSelect },
} satisfies Prisma.NotificationInclude;

export type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type ActorRow = NonNullable<NotificationRow['actor']>;

function toPublicUser(user: ActorRow): PublicUserView {
  return {
    id: user.id,
    username: user.account?.username ?? '',
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    presence: user.presence.toLowerCase() as PresenceStatus,
  };
}

/**
 * Build the contract payload from the stored JSON blob, overlaying the relational
 * `requestId` (request-backed notifications carry it as a column, note 5) so the FE always
 * has the id it needs to dispatch accept/decline.
 */
function toPayload(row: NotificationRow): NotificationPayloadView {
  const stored =
    row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)
      ? (row.payload as NotificationPayloadView)
      : {};
  return {
    ...stored,
    ...(row.requestId ? { requestId: row.requestId } : {}),
  };
}

/** Serialize a Notification row to the contract shape (enum → lowercase, actor → PublicUser). */
export function toNotificationView(row: NotificationRow): NotificationView {
  return {
    id: row.id,
    type: row.type.toLowerCase() as NotificationTypeView,
    actor: row.actor ? toPublicUser(row.actor) : null,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
    payload: toPayload(row),
  };
}
