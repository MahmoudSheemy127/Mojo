// src/events/app-events.ts
// Internal (in-process) domain event names + payload types. Domain services emit
// these AFTER their DB transaction commits (persist-then-broadcast, NF-16); the
// RealtimeModule listener translates them into outbound Socket.io emits. Feature
// modules depend on EventEmitter, never on RealtimeModule — so this file is the
// single shared contract between the two sides. See docs/BE/backend-design-nestjs.md §7.

import { MessageView } from "@common/types/conversation-view";
import { NotificationView } from "@common/types/notification-view";
import { GroupMemberView } from "@common/types/group-view";

export const AppEvent = {
  /** A user changed their presence status (PATCH /users/me/presence, or connect/disconnect). */
  PresenceChanged: 'presence.changed',
  MessageCreated: 'message.created',
  MessageDeleted: 'message.deleted',
  MessageRead: 'message.read',
  NotificationCreated: 'notification.created',
  ConversationCreated: 'conversation.created',
  GroupUpdated: 'group.updated',
  GroupDeleted: 'group.deleted',
  MemberAdded: 'member.added',
  MemberRemoved: 'member.removed',
  MemberRoleChanged: 'member.role_changed',
} as const;

export type AppEventName = (typeof AppEvent)[keyof typeof AppEvent];

/** Contract presence values (docs/contract/_common.yaml#Presence). */
export type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

/**
 * `presence.changed` → emitted by UsersService/PresenceService after persisting a
 * presence change. The listener fans `presence:changed { userId, status }` out to
 * each contact's `user:<id>` room (asyncapi.yaml#PresenceChanged).
 */
export interface PresenceChangedPayload {
  userId: string;
  status: PresenceStatus;
}

export interface MessageCreatedPayload {
  conversationId: string;
  /** Already serialized to the contract Message shape so the listener broadcasts it verbatim. */
  message: MessageView;
}

export interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
}



export interface MessageReadPayload {
  conversationId: string;
  lastReadMessageId: string;
  /** The reader; the listener fans `message:status { ..., userId }` out to the senders. */
  userId: string;
}


/**
 * `notification.created` → emitted by NotificationsService.create() after the row is
 * committed. The listener pushes `notification:new { notification }` to the recipient's
 * `user:<id>` room (asyncapi.yaml#NotificationNew). The view is already serialized to the
 * contract shape so the listener broadcasts it verbatim.
 */
export interface NotificationCreatedPayload {
  recipientId: string;
  notification: NotificationView;
}

/**
 * `conversation.created` → emitted by ConversationsService/GroupsService after the new
 * conversation + participants are committed. The listener resolves each recipient's view
 * (ConversationsService.getOne) and emits `conversation:new` to their `user:<id>` room.
 */
export interface ConversationCreatedPayload {
  conversationId: string;
  recipientIds: string[];
}

/**
 * `group.updated` → `group:updated`. Profile edits (name/description/avatar). The contract
 * Group carries the *viewer's* `role`, so the listener resolves a per-recipient view and
 * fans it out to each member's `user:<id>` room (asyncapi.yaml#GroupUpdated).
 */
export interface GroupUpdatedPayload {
  groupId: string;
  recipientIds: string[];
}

/**
 * `group.deleted` → `group:deleted`. Group id == conversation id (a group IS a
 * conversation), so the listener broadcasts to the `conversation:<id>` room every member is
 * already joined to (asyncapi.yaml#GroupDeleted).
 */
export interface GroupDeletedPayload {
  groupId: string;
}

/** `member.added` → `member:added` to the group's `conversation:<id>` room. */
export interface MemberAddedPayload {
  groupId: string;
  /** Already serialized to the contract GroupMember shape so the listener broadcasts verbatim. */
  member: GroupMemberView;
}

/** `member.removed` → `member:removed` to the group's `conversation:<id>` room. */
export interface MemberRemovedPayload {
  groupId: string;
  userId: string;
}

/** `member.role_changed` → `member:role_changed` to the group's `conversation:<id>` room. */
export interface MemberRoleChangedPayload {
  groupId: string;
  userId: string;
  role: 'admin' | 'member';
}

