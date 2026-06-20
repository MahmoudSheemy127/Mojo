// src/modules/users/dto/update-profile.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * PATCH /users/me — partial profile update (FR-11). Both fields optional; send only
 * what changed. `bio: null` explicitly clears it (users.openapi.yaml).
 */
export const UpdateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(50),
    bio: z.string().max(190).nullable(),
  })
  .partial();

export class UpdateProfileDto extends createZodDto(UpdateProfileSchema) {}
