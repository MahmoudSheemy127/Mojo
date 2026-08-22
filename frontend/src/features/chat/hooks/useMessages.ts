// src/features/chat/hooks/useMessages.ts
import { useInfiniteQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import type { ApiMessage, PublicUser } from '@/types/api';
import type { Message, MessageStatus } from '@/types/entities';
import { fetchMessages } from '../api';

export const messagesKey = (conversationId: string) =>
  ['messages', conversationId] as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toViewMessage(
  msg: ApiMessage,
  currentUserId: string | undefined,
  participants: Map<string, Pick<PublicUser, 'displayName' | 'avatarUrl'>>,
): Message {
  const own = !!currentUserId && msg.senderId === currentUserId;
  const sender = participants.get(msg.senderId);
  const self = currentUserId ? participants.get(currentUserId) : undefined;
  const authorName = own
    ? (self?.displayName ?? 'You')
    : (sender?.displayName ?? msg.senderId);
  const authorAvatarUrl = own
    ? (self?.avatarUrl ?? undefined)
    : (sender?.avatarUrl ?? undefined);

  const isOptimistic = msg.id.startsWith('optimistic-');
  const isFailed = msg.id.startsWith('failed-');

  let status: MessageStatus | undefined;
  if (own) {
    if (isOptimistic) status = 'sending';
    else if (isFailed) status = 'failed';
    else status = msg.status as MessageStatus;
  }

  return {
    id: msg.id,
    authorId: msg.senderId,
    authorName,
    authorAvatarUrl: authorAvatarUrl ?? undefined,
    body: msg.content ?? '',
    sentAt: isOptimistic || isFailed ? 'Sending…' : formatTime(msg.createdAt),
    sentAtIso: msg.createdAt,
    status,
    deleted: msg.deletedAt !== null,
    own,
    clientNonce: msg.clientNonce,
  };
}

/**
 * Infinite query for message history + live cache updates from socket events.
 * Pages are returned newest-first (index 0 = newest); flatten with reversed pages
 * to display oldest→newest.
 */
export function useMessages(
  conversationId: string,
  participants: Map<string, Pick<PublicUser, 'displayName' | 'avatarUrl'>>,
) {
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  const query = useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam }) =>
      fetchMessages(conversationId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    refetchOnMount: 'always',
  });

  // Flatten pages in reverse order for oldest→newest display
  const messages: Message[] = [...(query.data?.pages ?? [])]
    .reverse()
    .flatMap((page) => page.data)
    .map((msg) => toViewMessage(msg, currentUserId, participants));

  return {
    ...query,
    messages,
    isLoadingOlder: query.isFetchingNextPage,
    hasOlderMessages: !!query.hasNextPage,
  };
}
