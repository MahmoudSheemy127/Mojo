// src/features/chat/hooks/useMessageLiveUpdates.ts
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import type { ApiMessage, MessagesListResponse } from '@/types/api';
import { messagesKey } from './useMessages';

type MessagesData = InfiniteData<MessagesListResponse>;

/**
 * Global background listener that keeps every conversation's message cache warm
 * without a ChatWindow open. Mount once at the app shell (AppLayout) so incoming
 * messages are appended to the right `['messages', conversationId]` cache
 * regardless of which conversation is active.
 */
export function useMessageLiveUpdates() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  // socket: new message → append to newest page of its conversation
  const onMessageNew = useCallback(
    (payload: { message: ApiMessage }) => {
      const msg = payload.message;
      if (msg.senderId === currentUserId) return;

      queryClient.setQueryData<MessagesData>(
        messagesKey(msg.conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page, idx) => {
            if (idx !== 0) return page;
            if (page.data.some((m) => m.id === msg.id)) return page;
            const withoutOptimistic = msg.clientNonce
              ? page.data.filter((m) => m.clientNonce !== msg.clientNonce)
              : page.data;
            return { ...page, data: [...withoutOptimistic, msg] };
          });
          return { ...old, pages };
        },
      );
    },
    [queryClient, currentUserId],
  );
  useSocketEvent('message:new', onMessageNew);

  // socket: message deleted → patch in cache
  const onMessageDeleted = useCallback(
    (payload: { conversationId: string; messageId: string }) => {
      queryClient.setQueryData<MessagesData>(
        messagesKey(payload.conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.id === payload.messageId
                ? {
                    ...m,
                    deletedAt: new Date().toISOString(),
                    content: null,
                    attachments: [],
                  }
                : m,
            ),
          }));
          return { ...old, pages };
        },
      );
    },
    [queryClient],
  );
  useSocketEvent('message:deleted', onMessageDeleted);

  // socket: message status update → patch in cache
  const onMessageStatus = useCallback(
    (payload: {
      conversationId: string;
      messageId: string;
      status: 'delivered' | 'read';
      userId: string;
    }) => {
      queryClient.setQueryData<MessagesData>(
        messagesKey(payload.conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.id === payload.messageId
                ? { ...m, status: payload.status }
                : m,
            ),
          }));
          return { ...old, pages };
        },
      );
    },
    [queryClient],
  );
  useSocketEvent('message:status', onMessageStatus);
}
