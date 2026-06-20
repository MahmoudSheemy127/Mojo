// src/features/auth/hooks/useSignup.ts
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { signup } from '../api';
import type { SignupRequest } from '@/types/api';

/** Mutation: POST signup → auto-login (store token) → navigate home. */
export function useSignup() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (body: SignupRequest) => signup(body),
    onSuccess: (data) => {
      setUser(data.user, data.accessToken);
      void navigate('/c', { replace: true });
    },
  });
}
