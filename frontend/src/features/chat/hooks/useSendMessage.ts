// src/features/chat/hooks/useSendMessage.ts
import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { ApiMessage, MessagesListResponse } from '@/types/api';
import { sendMessage } from '../api';
import { messagesKey } from './useMessages';

type MessagesData = InfiniteData<MessagesListResponse>;

interface SendArgs {
  content: string;
  clientNonce: string;
}

function makeOptimistic(
  conversationId: string,
  content: string,
  clientNonce: string,
  senderId: string,
): ApiMessage {
  return {
    id: `optimistic-${clientNonce}`,
    conversationId,
    sequence: Date.now(),
    senderId,
    content,
    attachments: [],
    status: 'sent',
    createdAt: new Date().toISOString(),
    deletedAt: null,
    clientNonce,
  };
}

/** Optimistic send mutation with clientNonce reconciliation and rollback on error. */
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.currentUser);
  const toast = useToast();

  const prependToNewest = useCallback(
    (msg: ApiMessage) => {
      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page, idx) => {
            if (idx !== 0) return page;
            return { ...page, data: [...page.data, msg] };
          });
          return { ...old, pages };
        },
      );
    },
    [conversationId, queryClient],
  );

  const replaceInCache = useCallback(
    (clientNonce: string, serverMsg: ApiMessage) => {
      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.clientNonce === clientNonce ? serverMsg : m,
            ),
          }));
          return { ...old, pages };
        },
      );
    },
    [conversationId, queryClient],
  );

  const markFailed = useCallback(
    (clientNonce: string) => {
      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.clientNonce === clientNonce
                ? { ...m, id: `failed-${clientNonce}` }
                : m,
            ),
          }));
          return { ...old, pages };
        },
      );
    },
    [conversationId, queryClient],
  );

  interface MutationContext {
    snapshot: MessagesData | undefined;
    clientNonce: string;
  }

  return useMutation<ApiMessage, Error, SendArgs, MutationContext>({
    mutationFn: ({ content, clientNonce }) =>
      sendMessage(conversationId, { content, clientNonce }),

    onMutate: async ({ content, clientNonce }) => {
      await queryClient.cancelQueries({ queryKey: messagesKey(conversationId) });

      const snapshot = queryClient.getQueryData<MessagesData>(
        messagesKey(conversationId),
      );

      const optimistic = makeOptimistic(
        conversationId,
        content,
        clientNonce,
        currentUser?.id ?? '',
      );
      prependToNewest(optimistic);

      return { snapshot, clientNonce };
    },

    onSuccess: (serverMsg, _, ctx) => {
      replaceInCache(ctx!.clientNonce, serverMsg);
    },

    onError: (_err, _vars, ctx) => {
      // Keep the bubble visible in a 'failed' state for retry/delete affordance
      if (ctx?.clientNonce) markFailed(ctx.clientNonce);
      toast.error("Message couldn't be sent. Please try again.");
    },
  });
}
