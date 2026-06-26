// src/modules/conversations/dto/mark-read.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /conversations/:conversationId/read (FR-14). `lastReadMessageId` is a Message id,
 * which is a ULID (prisma-schema-design.md note 3) — not a UUID — so it is validated as a
 * non-empty string rather than `.uuid()`. (conversations.openapi.yaml#markConversationRead)
 */
export const MarkReadSchema = z.object({
  lastReadMessageId: z.string().min(1),
});

export class MarkReadDto extends createZodDto(MarkReadSchema) {}
