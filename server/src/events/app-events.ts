// src/events/app-events.ts
// Internal (in-process) domain event names + payload types. Domain services emit
// these AFTER their DB transaction commits (persist-then-broadcast, NF-16); the
// RealtimeModule listener translates them into outbound Socket.io emits. Feature
// modules depend on EventEmitter, never on RealtimeModule — so this file is the
// single shared contract between the two sides. See docs/BE/backend-design-nestjs.md §7.

import { Conversation, Group, GroupRole, Member, Message, Notification } from "@prisma/client";

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
  message: Message;
}

export interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
}



export interface MessageReadPayload {
  conversationId: string;
  lastReadMessageId: string;
}


export interface NotificationCreatedPayload {
  notification: Notification;
}

export interface ConversationCreatedPayload {
  conversation: Conversation;
}

export interface GroupUpdatedPayload {
  group: Group;
}

export interface GroupDeletedPayload {
  groupId: string;
}

export interface MemberAddedPayload {
  groupId: string;
  member: Member;
}

export interface MemberRemovedPayload {
  groupId: string;
  userId: string;
}

export interface MemberRoleChangedPayload {
  groupId: string;
  userId: string;
  role: GroupRole;
}

