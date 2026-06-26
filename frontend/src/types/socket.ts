// src/types/socket.ts
// Typed socket event contracts derived from docs/contract/asyncapi.yaml.
// ServerToClientEvents — events the server emits to this client.
// ClientToServerEvents — events this client emits to the server.
import type { ApiMessage, Conversation, Presence } from './api';

export interface ServerToClientEvents {
  // ── Messaging ──────────────────────────────────────────────────
  'message:new': (payload: { message: ApiMessage }) => void;
  'message:deleted': (payload: { conversationId: string; messageId: string }) => void;
  'message:status': (payload: {
    conversationId: string;
    messageId: string;
    status: 'delivered' | 'read';
    userId: string;
  }) => void;

  // ── Typing (FR-15) ─────────────────────────────────────────────
  'typing:start': (payload: { conversationId: string; userId: string }) => void;
  'typing:stop': (payload: { conversationId: string; userId: string }) => void;

  // ── Presence (FR-10) ───────────────────────────────────────────
  'presence:changed': (payload: { userId: string; status: Presence }) => void;

  // ── Notifications (FR-30) ──────────────────────────────────────
  'notification:new': (payload: { notification: unknown }) => void;

  // ── Conversations & groups ─────────────────────────────────────
  'conversation:new': (payload: { conversation: Conversation }) => void;
  'group:updated': (payload: { group: unknown }) => void;
  'group:deleted': (payload: { groupId: string }) => void;
  'member:added': (payload: { groupId: string; member: unknown }) => void;
  'member:removed': (payload: { groupId: string; userId: string }) => void;
  'member:role_changed': (payload: {
    groupId: string;
    userId: string;
    role: string;
  }) => void;
}

export interface ClientToServerEvents {
  'typing:start': (payload: { conversationId: string }) => void;
  'typing:stop': (payload: { conversationId: string }) => void;
  'message:read': (payload: {
    conversationId: string;
    lastReadMessageId: string;
  }) => void;
}
