// src/features/presence/hooks/useUpdatePresence.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { Presence, SelfUser, SettablePresence } from '@/types/api';
import { meKey } from '@/features/settings/hooks/useMe';
import { updatePresence } from '../api';

/**
 * Mutation: update own presence. Optimistic per @fe-design §2.6 — the dot flips
 * immediately in the `['me']` cache and the persisted auth store, rolling back
 * if the request fails.
 */
export function useUpdatePresence() {
  const queryClient = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const toast = useToast();

  return useMutation({
    mutationFn: (status: SettablePresence) => updatePresence({ status }),
    onMutate: async (status) => {
      await queryClient.cancelQueries({ queryKey: meKey });
      const previous = queryClient.getQueryData<SelfUser>(meKey);
      const optimistic = status as Presence;
      queryClient.setQueryData<SelfUser>(meKey, (user) =>
        user ? { ...user, presence: optimistic } : user,
      );
      patchUser({ presence: optimistic });
      return { previous };
    },
    onError: (_error, _status, context) => {
      if (context?.previous) {
        queryClient.setQueryData(meKey, context.previous);
        patchUser({ presence: context.previous.presence });
      }
      toast.error("Couldn't update your status. Please try again.");
    },
    onSuccess: (data) => {
      queryClient.setQueryData<SelfUser>(meKey, (user) =>
        user ? { ...user, presence: data.presence } : user,
      );
      patchUser({ presence: data.presence });
    },
  });
}
