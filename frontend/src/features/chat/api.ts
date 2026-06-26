// src/features/chat/api.ts
import { api } from '@/lib/axios';
import type {
  ListConversationsResponse,
  GetConversationResponse,
  OpenDmResponse,
  MessagesListResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@/types/api';

// ── Conversations ────────────────────────────────────────────────

/** GET /conversations — sorted by lastActivityAt desc, DMs + groups. */
export async function fetchConversations(
  cursor?: string,
): Promise<ListConversationsResponse> {
  const { data } = await api.get<ListConversationsResponse>('/conversations', {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

/** GET /conversations/:id — caller must be a participant. */
export async function getConversation(
  conversationId: string,
): Promise<GetConversationResponse> {
  const { data } = await api.get<GetConversationResponse>(
    `/conversations/${conversationId}`,
  );
  return data;
}

/**
 * POST /conversations/dm — idempotent open/create a 1-on-1 DM.
 * 200 if already exists, 201 if newly created.
 */
export async function openDm(userId: string): Promise<OpenDmResponse> {
  const { data } = await api.post<OpenDmResponse>('/conversations/dm', {
    userId,
  });
  return data;
}

/** POST /conversations/:id/read — advance read-marker, clear unreadCount. */
export async function markConversationRead(
  conversationId: string,
  lastReadMessageId: string,
): Promise<void> {
  await api.post(`/conversations/${conversationId}/read`, { lastReadMessageId });
}

// ── Messages ─────────────────────────────────────────────────────

/**
 * GET /conversations/:conversationId/messages — paginated backward in time.
 * Omit cursor for the newest page; supply nextCursor for older pages.
 */
export async function fetchMessages(
  conversationId: string,
  cursor?: string,
): Promise<MessagesListResponse> {
  const { data } = await api.get<MessagesListResponse>(
    `/conversations/${conversationId}/messages`,
    { params: cursor ? { cursor } : undefined },
  );
  return data;
}

/** POST /conversations/:conversationId/messages — persist-before-ack (NF-16). */
export async function sendMessage(
  conversationId: string,
  body: SendMessageRequest,
): Promise<SendMessageResponse> {
  const { data } = await api.post<SendMessageResponse>(
    `/conversations/${conversationId}/messages`,
    body,
    { validateStatus: (s) => s === 201 },
  );
  return data;
}

/** DELETE /messages/:messageId — soft-delete own message (FR-16). */
export async function deleteMessage(messageId: string): Promise<void> {
  await api.delete(`/messages/${messageId}`);
}

export type { GetConversationResponse };
