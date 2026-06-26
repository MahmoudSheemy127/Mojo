// src/features/chat/hooks/useMessages.ts
import { useCallback } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import type { ApiMessage, MessagesListResponse, PublicUser } from '@/types/api';
import type { Message, MessageStatus } from '@/types/entities';
import { fetchMessages } from '../api';

export const messagesKey = (conversationId: string) =>
  ['messages', conversationId] as const;

type MessagesData = InfiniteData<MessagesListResponse>;

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
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: messagesKey(conversationId),
    queryFn: ({ pageParam }) =>
      fetchMessages(conversationId, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  // socket: new message → append to newest page
  const onMessageNew = useCallback(
    (payload: { message: ApiMessage }) => {
      if (payload.message.conversationId !== conversationId) return;
      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
        (old) => {
          if (!old) return old;
          const pages = old.pages.map((page, idx) => {
            if (idx !== 0) return page;
            const alreadyPresent = page.data.some(
              (m) => m.id === payload.message.id,
            );
            if (alreadyPresent) return page;
            // Replace matching optimistic bubble (same clientNonce) if present
            const withoutOptimistic = payload.message.clientNonce
              ? page.data.filter(
                  (m) => m.clientNonce !== payload.message.clientNonce,
                )
              : page.data;
            return { ...page, data: [...withoutOptimistic, payload.message] };
          });
          return { ...old, pages };
        },
      );
    },
    [conversationId, queryClient],
  );
  useSocketEvent('message:new', onMessageNew);

  // socket: message deleted → patch in cache
  const onMessageDeleted = useCallback(
    (payload: { conversationId: string; messageId: string }) => {
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
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
    [conversationId, queryClient],
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
      if (payload.conversationId !== conversationId) return;
      queryClient.setQueryData<MessagesData>(
        messagesKey(conversationId),
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
    [conversationId, queryClient],
  );
  useSocketEvent('message:status', onMessageStatus);

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
