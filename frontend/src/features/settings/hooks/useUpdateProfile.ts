// src/features/settings/hooks/useUpdateProfile.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { UpdateProfileRequest } from '@/types/api';
import { updateProfile } from '../api';
import { meKey } from './useMe';

/** Mutation: PATCH /users/me. Writes the fresh profile back to the `['me']`
 *  cache + persisted auth store, and surfaces a success/error toast (FR-11). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const patchUser = useAuthStore((s) => s.patchUser);
  const toast = useToast();

  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => updateProfile(body),
    onSuccess: (user) => {
      queryClient.setQueryData(meKey, user);
      patchUser(user);
      toast.success('Profile updated.');
    },
    onError: () => toast.error("Couldn't save changes. Please try again."),
  });
}
