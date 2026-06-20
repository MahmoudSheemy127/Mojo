// src/features/auth/hooks/useLogin.ts
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { login } from '../api';
import type { LoginRequest } from '@/types/api';

/** Mutation: POST login → store token → navigate home. */
export function useLogin() {
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (body: LoginRequest) => login(body),
    onSuccess: (data) => {
      setUser(data.user, data.accessToken);
      void navigate('/c', { replace: true });
    },
  });
}
