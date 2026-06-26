// src/features/settings/hooks/useBlockedUsers.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import type { PublicUser } from '@/types/api';
import { fetchBlockedUsers, unblockUser } from '../api';

/** Query key for the blocked-users list (@fe-design §2.6). */
export const blockedUsersKey = ['contacts', 'blocked'] as const;

/** Query: users the current user has blocked (FR-09). */
export function useBlockedUsers() {
  return useQuery<PublicUser[]>({
    queryKey: blockedUsersKey,
    queryFn: fetchBlockedUsers,
  });
}

/** Mutation: unblock a user; removes the row from the cached list. */
export function useUnblockUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: string) => unblockUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<PublicUser[]>(blockedUsersKey, (list) =>
        list ? list.filter((user) => user.id !== userId) : list,
      );
      toast.success('User unblocked.');
    },
    onError: () => toast.error("Couldn't unblock. Please try again."),
  });
}
