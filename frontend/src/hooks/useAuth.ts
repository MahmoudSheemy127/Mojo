// src/hooks/useAuth.ts
import { useAuthStore } from '@/store/authStore';

/** Read-only view of the current auth session. */
export function useAuth() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return { user: currentUser, isAuthenticated };
}
