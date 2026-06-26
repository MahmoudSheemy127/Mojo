// src/features/contacts/hooks/useRemoveFriend.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import type { PublicUser } from '@/types/api';
import { removeFriend } from '../api';
import { friendsKey } from './useContacts';

/** Mutation: remove a contact symmetrically (FR-07). Optimistically removes the row. */
export function useRemoveFriend() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: string) => removeFriend(userId),
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
      toast.error("Couldn't remove friend. Please try again.");
    },
    onSuccess: () => {
      toast.success('Friend removed.');
    },
  });
}
