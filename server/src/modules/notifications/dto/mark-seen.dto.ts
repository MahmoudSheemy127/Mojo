// src/modules/notifications/dto/mark-seen.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /notifications/seen body (docs/contract/notifications.openapi.yaml). The body is
 * optional; omitting `ids` marks ALL of the caller's unseen notifications seen, otherwise
 * only the listed ones.
 */
export const MarkSeenSchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export type MarkSeenQuery = z.infer<typeof MarkSeenSchema>;

export class MarkSeenDto extends createZodDto(MarkSeenSchema) {}
