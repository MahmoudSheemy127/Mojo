// src/modules/messages/dto/list-messages.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * GET /conversations/:conversationId/messages query (messages.openapi.yaml#listMessages).
 * Keyset pagination going BACKWARD in time: `cursor` is opaque (omit for the newest page),
 * `limit` is server-capped (default 30, max 100) — mirrors _common.yaml Cursor/Limit.
 */
export const ListMessagesSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type ListMessagesQuery = z.infer<typeof ListMessagesSchema>;

export class ListMessagesDto extends createZodDto(ListMessagesSchema) {}
