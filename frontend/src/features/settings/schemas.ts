// src/features/settings/schemas.ts
import { z } from 'zod';

// Mirrors docs/contract/users.openapi.yaml PATCH /users/me constraints exactly:
//   displayName: string, 1..50   ·   bio: string|null, max 190
export const MAX_DISPLAY_NAME = 50;
export const MAX_BIO = 190;

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(MAX_DISPLAY_NAME, `Display name must be at most ${MAX_DISPLAY_NAME} characters`),
  bio: z.string().max(MAX_BIO, `Bio must be at most ${MAX_BIO} characters`),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

// ── Avatar upload validation (client-side, before PUT /users/me/avatar) ──
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_AVATAR_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

/** Returns an error message if the file is unacceptable, else null. */
export function validateAvatarFile(file: File): string | null {
  if (!ACCEPTED_AVATAR_TYPES.includes(file.type)) {
    return 'Choose a PNG, JPEG, GIF, or WebP image.';
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return 'Image must be 5 MB or smaller.';
  }
  return null;
}
