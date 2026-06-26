// src/features/settings/hooks/useMe.ts
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import type { SelfUser } from '@/types/api';
import { getMe } from '../api';

/** Query key for the current user's profile (@fe-design §2.6). */
export const meKey = ['me'] as const;

/**
 * Current-user profile query. Seeds from the persisted auth store so the UI is
 * populated instantly after login/refresh, then revalidates from GET /users/me.
 */
export function useMe() {
  const currentUser = useAuthStore((s) => s.currentUser);
  return useQuery<SelfUser>({
    queryKey: meKey,
    queryFn: getMe,
    ...(currentUser ? { initialData: currentUser } : {}),
  });
}
