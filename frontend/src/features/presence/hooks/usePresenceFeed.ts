// src/features/presence/hooks/usePresenceFeed.ts
// Listens for presence:changed socket events and updates the friends list cache.
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { friendsKey } from '@/features/contacts/hooks/useContacts';
import type { PublicUser, Presence } from '@/types/api';

/**
 * Subscribes to `presence:changed` socket events and patches the corresponding
 * entry in the `['contacts', 'friends']` TanStack Query cache. Mount once at the
 * authenticated app level (e.g. AppLayout) so presence stays live while the app
 * is open.
 */
export function usePresenceFeed() {
  const queryClient = useQueryClient();

  const onPresenceChanged = useCallback(
    (payload: { userId: string; status: Presence }) => {
      queryClient.setQueryData<PublicUser[]>(
        [...friendsKey],
        (old) => {
          if (!old) return old;
          return old.map((f) =>
            f.id === payload.userId ? { ...f, presence: payload.status } : f,
          );
        },
      );
    },
    [queryClient],
  );

  useSocketEvent('presence:changed', onPresenceChanged);
}
