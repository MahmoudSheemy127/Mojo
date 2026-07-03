// src/features/contacts/hooks/useConversations.ts
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import type { Conversation, DmConversation } from '@/types/api';
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
