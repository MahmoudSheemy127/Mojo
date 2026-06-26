// src/modules/conversations/dto/open-dm.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /conversations/dm (FR-12). The body carries the contact to DM; the caller is taken
 * from the access token. (conversations.openapi.yaml#openDm)
 */
export const OpenDmSchema = z.object({
  userId: z.string().uuid(),
});

export class OpenDmDto extends createZodDto(OpenDmSchema) {}
