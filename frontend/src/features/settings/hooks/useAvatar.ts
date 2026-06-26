// src/features/settings/hooks/useAvatar.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { SelfUser } from '@/types/api';
import { deleteAvatar, uploadAvatar } from '../api';
import { meKey } from './useMe';

/** Mutation: PUT /users/me/avatar. Patches the new URL into the `['me']` cache. */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const toast = useToast();

  return useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: ({ avatarUrl }) => {
      queryClient.setQueryData<SelfUser>(meKey, (user) =>
        user ? { ...user, avatarUrl } : user,
      );
      patchUser({ avatarUrl });
      toast.success('Avatar updated.');
    },
    onError: () => toast.error("Couldn't upload that image. Please try again."),
  });
}

/** Mutation: DELETE /users/me/avatar — revert to the initials fallback. */
export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const toast = useToast();

  return useMutation({
    mutationFn: () => deleteAvatar(),
    onSuccess: () => {
      queryClient.setQueryData<SelfUser>(meKey, (user) =>
        user ? { ...user, avatarUrl: null } : user,
      );
      patchUser({ avatarUrl: null });
      toast.success('Avatar removed.');
    },
    onError: () => toast.error("Couldn't remove your avatar. Please try again."),
  });
}
