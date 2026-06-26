// src/features/settings/api.ts
import { api } from '@/lib/axios';
import type {
  AvatarUploadResponse,
  BlockedUsersResponse,
  PublicUser,
  SelfUser,
  UpdateProfileRequest,
} from '@/types/api';

/** GET /users/me — the authenticated user's full profile. */
export async function getMe(): Promise<SelfUser> {
  const { data } = await api.get<SelfUser>('/users/me');
  return data;
}

/** PATCH /users/me — update display name / bio (FR-11). */
export async function updateProfile(
  body: UpdateProfileRequest,
): Promise<SelfUser> {
  const { data } = await api.patch<SelfUser>('/users/me', body);
  return data;
}

/** PUT /users/me/avatar — multipart upload, returns the new avatar URL (FR-11). */
export async function uploadAvatar(file: File): Promise<AvatarUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<AvatarUploadResponse>(
    '/users/me/avatar',
    form,
  );
  return data;
}

/** DELETE /users/me/avatar — revert to the initials fallback (FR-11). */
export async function deleteAvatar(): Promise<void> {
  await api.delete('/users/me/avatar');
}

/** GET /contacts/blocked — users the caller has blocked (FR-09). */
export async function fetchBlockedUsers(): Promise<PublicUser[]> {
  const { data } = await api.get<BlockedUsersResponse>('/contacts/blocked');
  return data.data;
}

/** DELETE /contacts/blocks/{userId} — unblock a user (FR-09). */
export async function unblockUser(userId: string): Promise<void> {
  await api.delete(`/contacts/blocks/${userId}`);
}

/** POST /auth/password-reset/request — email a reset link (FR-04). */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password-reset/request', { email });
}
