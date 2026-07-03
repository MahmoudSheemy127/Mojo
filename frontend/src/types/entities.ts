// src/types/entities.ts
//
// Minimal, presentation-oriented domain shapes. These exist to type component
// props and placeholder fixtures for the UI skeleton — they are NOT the API
// contract (that lives in api.ts / api.generated.ts) and will be refined when
// the data layer lands.

export type Presence = 'online' | 'idle' | 'dnd' | 'offline';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | undefined;
  presence?: Presence | undefined;
  bio?: string | undefined;
}

export type ConversationType = 'dm' | 'group';

/** A row in the chat list. */
export interface ConversationSummary {
  id: string;
  type: ConversationType;
  name: string;
  avatarUrl?: string | undefined;
  /** Present for DM rows so a presence dot can render. */
  presence?: Presence | undefined;
  lastMessagePreview?: string | undefined;
  /** Pre-formatted relative time, e.g. "2m". */
  lastMessageAt?: string | undefined;
  unreadCount?: number | undefined;
  /** True when the other party is currently typing (DM). */
  typing?: boolean | undefined;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl?: string | undefined;
  body: string;
  /** Pre-formatted relative time for display. */
  sentAt: string;
  /** Absolute ISO timestamp, surfaced on hover. */
  sentAtIso?: string | undefined;
  /** Set on the current user's own messages. */
  status?: MessageStatus | undefined;
  deleted?: boolean | undefined;
  /** Marks the current user's own message (right-aligned, status shown). */
  own?: boolean | undefined;
  /** Client-generated nonce used to reconcile optimistic bubbles. */
  clientNonce?: string | undefined;
}

export type Role = 'admin' | 'member';

export interface GroupMember {
  id: string;
  user: User;
  role: Role;
}

export type NotificationKind =
  | 'friend-request'
  | 'group-invite'
  | 'join-request'
  | 'generic';

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: User;
  /** Pre-rendered descriptive text. */
  text: string;
  /** Pre-formatted relative time. */
  createdAt: string;
  unread?: boolean | undefined;
  /** Group context for invite / join-request notifications. */
  groupName?: string | undefined;
  // ── Payload ids (from the server notification) used to dispatch the
  //    type-specific action endpoint and mention navigation. ──
  /** Contact request id — friend-request accept/decline. */
  requestId?: string | undefined;
  /** Invite id — group-invite accept/decline. */
  inviteId?: string | undefined;
  /** Group id — group-invite and join-request actions. */
  groupId?: string | undefined;
  /** Conversation id — mention navigation target. */
  conversationId?: string | undefined;
  /** Message id — mention navigation target. */
  messageId?: string | undefined;
}
