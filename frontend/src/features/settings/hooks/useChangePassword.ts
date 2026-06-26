// src/features/settings/hooks/useChangePassword.ts
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { requestPasswordReset } from '../api';

/**
 * Mutation: trigger the emailed password-reset flow (FR-04). The contract
 * exposes only the reset-by-email flow (POST /auth/password-reset/request) — no
 * authenticated change-password endpoint — so Settings reuses it: the user
 * receives the same link used from the Login screen.
 */
export function useRequestPasswordReset() {
  const toast = useToast();

  return useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
    onSuccess: () =>
      toast.success('Check your inbox for a password reset link.'),
    onError: () => toast.error("Couldn't send the email. Please try again."),
  });
}
