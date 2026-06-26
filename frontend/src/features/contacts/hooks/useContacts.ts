// src/features/contacts/hooks/useContacts.ts
import { useQuery } from '@tanstack/react-query';
import type { PublicUser } from '@/types/api';
import { fetchFriends } from '../api';

/** Query key for the friends list (@fe-design §2.6). */
export const friendsKey = ['contacts', 'friends'] as const;

/** Query: current user's accepted friends with live-ish presence (FR-06). */
export function useContacts() {
  return useQuery<PublicUser[]>({
    queryKey: friendsKey,
    queryFn: async () => {
      const res = await fetchFriends();
      return res.data;
    },
  });
}
