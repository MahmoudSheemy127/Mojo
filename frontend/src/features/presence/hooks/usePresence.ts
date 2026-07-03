// src/features/presence/hooks/usePresence.ts
// Listens for presence:changed socket events and updates DM presence in the
// conversation-list cache. Complements usePresenceFeed, which patches the
// friends list; this keeps the presence dots in the chat list (ChatSessionRow)
// live for direct-message peers.
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { conversationsKey } from '@/features/contacts/hooks/useConversations';
import type { Conversation, Presence } from '@/types/api';

/**
 * Subscribes to `presence:changed` and patches `otherUser.presence` for any DM
 * in the `['conversations']` cache whose peer changed status. Mount once at the
 * authenticated app level (e.g. AppLayout), alongside usePresenceFeed.
 */
export function usePresence() {
  const queryClient = useQueryClient();

  const onPresenceChanged = useCallback(
    (payload: { userId: string; status: Presence }) => {
      queryClient.setQueryData<Conversation[]>(
        [...conversationsKey],
        (old) => {
          if (!old) return old;
          return old.map((c) =>
            c.type === 'dm' && c.otherUser.id === payload.userId
              ? { ...c, otherUser: { ...c.otherUser, presence: payload.status } }
              : c,
          );
        },
      );
    },
    [queryClient],
  );

  useSocketEvent('presence:changed', onPresenceChanged);
}
