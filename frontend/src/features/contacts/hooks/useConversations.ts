// src/features/contacts/hooks/useConversations.ts
import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useMatch } from 'react-router-dom';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { useAuthStore } from '@/store/authStore';
import type { ApiMessage, Conversation, DmConversation } from '@/types/api';
import { fetchConversations, openDm } from '@/features/chat/api';

/** Query key for the conversation list (@fe-design §2.6). */
export const conversationsKey = ['conversations'] as const;

/** Query: all active chat sessions sorted by most-recent activity. */
export function useConversations() {
  const queryClient = useQueryClient();

  const query = useQuery<Conversation[]>({
    queryKey: conversationsKey,
    queryFn: async () => {
      const res = await fetchConversations();
      return res.data;
    },
  });

  // socket: new conversation → prepend to the list (e.g. accepted DM)
  const onConversationNew = useCallback(
    (payload: { conversation: Conversation }) => {
      queryClient.setQueryData<Conversation[]>(
        [...conversationsKey],
        (old) => {
          if (!old) return [payload.conversation];
          if (old.some((c) => c.id === payload.conversation.id)) return old;
          return [payload.conversation, ...old];
        },
      );
    },
    [queryClient],
  );
  useSocketEvent('conversation:new', onConversationNew);

  return query;
}

/**
 * Global background listeners that keep the conversation list live without a
 * ChatWindow open. Mount once at the app shell (AppLayout) so incoming messages
 * update the sidebar preview + unread badge for every conversation, not just the
 * one currently on screen.
 */
export function useConversationLiveUpdates() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const activeConversationId = useMatch('/c/:conversationId')?.params
    .conversationId;

  // socket: new message → bump lastMessage + unreadCount, reorder to top
  const onMessageNew = useCallback(
    (payload: { message: ApiMessage }) => {
      const msg = payload.message;
      queryClient.setQueryData<Conversation[]>(conversationsKey, (old) => {
        if (!old) {
          void queryClient.invalidateQueries({ queryKey: conversationsKey });
          return old;
        }
        const idx = old.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) {
          void queryClient.invalidateQueries({ queryKey: conversationsKey });
          return old;
        }
        const conv = old[idx]!;
        const isOwn = msg.senderId === currentUserId;
        const isActive = msg.conversationId === activeConversationId;
        const updated = {
          ...conv,
          lastMessage: msg,
          lastActivityAt: msg.createdAt,
          unreadCount:
            isOwn || isActive ? conv.unreadCount : conv.unreadCount + 1,
        } as Conversation;
        return [updated, ...old.slice(0, idx), ...old.slice(idx + 1)];
      });
    },
    [queryClient, currentUserId, activeConversationId],
  );
  useSocketEvent('message:new', onMessageNew);

  // socket: message deleted → refresh the preview if it was the lastMessage
  const onMessageDeleted = useCallback(
    (payload: { conversationId: string; messageId: string }) => {
      const list = queryClient.getQueryData<Conversation[]>(conversationsKey);
      const conv = list?.find((c) => c.id === payload.conversationId);
      if (conv?.lastMessage?.id === payload.messageId) {
        void queryClient.invalidateQueries({ queryKey: conversationsKey });
      }
    },
    [queryClient],
  );
  useSocketEvent('message:deleted', onMessageDeleted);

  // Reset local unreadCount when the active conversation changes (viewing clears it).
  useEffect(() => {
    if (!activeConversationId) return;
    queryClient.setQueryData<Conversation[]>(conversationsKey, (old) => {
      if (!old) return old;
      return old.map((c) =>
        c.id === activeConversationId && c.unreadCount > 0
          ? { ...c, unreadCount: 0 }
          : c,
      );
    });
  }, [activeConversationId, queryClient]);
}

/**
 * Mutation: open or create a 1-on-1 DM with a user (FR-12).
 * On success, invalidates the conversation list and navigates to the chat.
 */
export function useOpenDm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation<DmConversation, Error, string>({
    mutationFn: (userId) => openDm(userId),
    onSuccess: (conversation) => {
      void queryClient.invalidateQueries({ queryKey: conversationsKey });
      void navigate(`/c/${conversation.id}`);
    },
  });
}
