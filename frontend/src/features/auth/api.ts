// src/features/auth/api.ts
import { api } from '@/lib/axios';
import type {
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
} from '@/types/api';

export async function login(body: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login', body);
  return data;
}

export async function signup(body: SignupRequest): Promise<SignupResponse> {
  const { data } = await api.post<SignupResponse>('/auth/signup', body);
  return data;
}

/** POST /auth/logout — invalidate the refresh token server-side (FR-03). */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

/** Full-page redirect target that starts the Google OAuth flow (FR-02). */
export function googleOAuthStart(): string {
  return `${import.meta.env.VITE_API_URL}/auth/google`;
}
