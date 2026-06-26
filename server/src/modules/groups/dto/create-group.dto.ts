// src/modules/groups/dto/create-group.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /groups (FR-18). Creator becomes the first admin; `memberIds` are added directly and
 * must be the caller's contacts and not blocked. (groups.openapi.yaml#createGroup)
 */
export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(300).optional(),
  avatarId: z.string().uuid().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export class CreateGroupDto extends createZodDto(CreateGroupSchema) {}
