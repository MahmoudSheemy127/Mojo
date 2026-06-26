// src/features/chat/hooks/useConversation.ts
import { useQuery } from '@tanstack/react-query';
import type { Conversation } from '@/types/api';
import { getConversation } from '../api';

export const conversationKey = (id: string) => ['conversations', id] as const;

/** Query: single conversation metadata (participants, type, lastMessage). */
export function useConversation(conversationId: string) {
  return useQuery<Conversation>({
    queryKey: conversationKey(conversationId),
    queryFn: () => getConversation(conversationId),
    enabled: !!conversationId,
  });
}
