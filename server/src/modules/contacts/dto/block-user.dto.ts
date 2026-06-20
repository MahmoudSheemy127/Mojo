// src/modules/contacts/dto/block-user.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /contacts/blocks (FR-08). The body carries the id of the user to block.
 * (contacts.openapi.yaml#blockUser)
 */
export const BlockUserSchema = z.object({
  userId: z.string().uuid(),
});

export class BlockUserDto extends createZodDto(BlockUserSchema) {}
