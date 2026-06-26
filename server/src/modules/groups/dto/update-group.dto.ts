// src/modules/groups/dto/update-group.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * PATCH /groups/:groupId (FR-23) — admin profile edit. Send only changed fields; `null`
 * clears description/avatar. (groups.openapi.yaml#updateGroup)
 */
export const UpdateGroupSchema = z
  .object({
    name: z.string().min(1).max(80),
    description: z.string().max(300).nullable(),
    avatarId: z.string().uuid().nullable(),
  })
  .partial();

export class UpdateGroupDto extends createZodDto(UpdateGroupSchema) {}
