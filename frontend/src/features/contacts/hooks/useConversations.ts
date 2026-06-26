// src/features/contacts/hooks/useConversations.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Conversation, DmConversation } from '@/types/api';
import { fetchConversations, openDm } from '@/features/chat/api';

/** Query key for the conversation list (@fe-design §2.6). */
export const conversationsKey = ['conversations'] as const;

/** Query: all active chat sessions sorted by most-recent activity. */
export function useConversations() {
  return useQuery<Conversation[]>({
    queryKey: conversationsKey,
    queryFn: async () => {
      const res = await fetchConversations();
      return res.data;
    },
  });
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
