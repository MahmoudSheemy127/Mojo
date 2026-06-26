// src/features/auth/hooks/useLogout.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { logout } from '../api';

/**
 * Mutation: POST logout → clear local session + caches → redirect to /login
 * (FR-03). Clearing happens in `onSettled` so a failed/expired server call still
 * logs the user out locally (logout must never leave a half-authenticated UI).
 */
export function useLogout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => logout(),
    onSettled: () => {
      clear();
      queryClient.clear();
      void navigate('/login', { replace: true });
    },
  });
}
