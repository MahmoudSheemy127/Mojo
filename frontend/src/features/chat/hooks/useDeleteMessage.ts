// src/features/chat/hooks/useDeleteMessage.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import type { MessagesListResponse } from '@/types/api';
import { deleteMessage } from '../api';
import { messagesKey } from './useMessages';

type MessagesData = InfiniteData<MessagesListResponse>;

/** Soft-delete own message (FR-16). Optimistically marks deleted in cache. */
export function useDeleteMessage(conversationId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  interface MutationContext {
    snapshot: MessagesData | undefined;
  }

  return useMutation<void, Error, string, MutationContext>({
    mutationFn: (messageId) => deleteMessage(messageId),

    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: messagesKey(conversationId) });
      const snapshot = queryClient.getQueryData<MessagesData>(
        messagesKey(conversationId),
      );

      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            data: page.data.map((m) =>
              m.id === messageId
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

      return { snapshot };
    },

    onError: (_err, _messageId, ctx) => {
      if (ctx?.snapshot) {
        queryClient.setQueryData(messagesKey(conversationId), ctx.snapshot);
      }
      toast.error("Couldn't delete the message. Please try again.");
    },
  });
}
