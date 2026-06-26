// src/features/contacts/hooks/useUserSearch.ts
import { useQuery } from '@tanstack/react-query';
import type { UserSearchResult } from '@/types/api';
import { searchUsers } from '../api';

/** Query key factory for user search results. */
export const userSearchKey = (q: string) => ['users', 'search', q] as const;

/**
 * Debounced user search — enabled only when `query` is non-empty.
 * The caller is responsible for debouncing before passing the value here.
 * Query key: ['users', 'search', query] (@fe-design §2.6).
 */
export function useUserSearch(query: string) {
  return useQuery<UserSearchResult[]>({
    queryKey: userSearchKey(query),
    queryFn: async () => {
      const res = await searchUsers(query);
      return res.data;
    },
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}
