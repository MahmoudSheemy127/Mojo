// src/features/contacts/hooks/useBlockUser.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import type { PublicUser } from '@/types/api';
import { blockUser } from '../api';
import { friendsKey } from './useContacts';
import { blockedUsersKey } from '@/features/settings/hooks/useBlockedUsers';

/** Mutation: block a user (FR-08). Removes from friends list; invalidates blocked list. */
export function useBlockUser() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: string) => blockUser(userId),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: friendsKey });
      const previous = queryClient.getQueryData<PublicUser[]>(friendsKey);
      queryClient.setQueryData<PublicUser[]>(friendsKey, (list) =>
        list ? list.filter((u) => u.id !== userId) : list,
      );
      return { previous };
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(friendsKey, context.previous);
      }
      toast.error("Couldn't block user. Please try again.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: blockedUsersKey });
      toast.success('User blocked.');
    },
  });
}
