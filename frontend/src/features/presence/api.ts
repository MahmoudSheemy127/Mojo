// src/features/presence/api.ts
import { api } from '@/lib/axios';
import type { SetPresenceRequest, SetPresenceResponse } from '@/types/api';

/** PATCH /users/me/presence — set the current user's availability (FR-10). */
export async function updatePresence(
  body: SetPresenceRequest,
): Promise<SetPresenceResponse> {
  const { data } = await api.patch<SetPresenceResponse>(
    '/users/me/presence',
    body,
  );
  return data;
}
