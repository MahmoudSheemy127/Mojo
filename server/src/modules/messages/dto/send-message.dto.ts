// src/modules/messages/dto/send-message.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /conversations/:conversationId/messages body (messages.openapi.yaml#sendMessage).
 * `content` may be null when attachments carry the message; `attachmentIds` reference rows
 * from POST /attachments; `clientNonce` is echoed back to reconcile the optimistic bubble.
 *
 * Contract rule: at least one of `content` (non-empty) or `attachmentIds` must be present —
 * an empty message is a 422 VALIDATION_ERROR (the ZodValidationException → 422 mapping lives
 * in AllExceptionsFilter).
 */
export const SendMessageSchema = z
  .object({
    content: z.string().nullish(),
    attachmentIds: z.array(z.string().uuid()).optional(),
    clientNonce: z.string().optional(),
  })
  .refine(
    (v) =>
      (typeof v.content === 'string' && v.content.trim().length > 0) ||
      (Array.isArray(v.attachmentIds) && v.attachmentIds.length > 0),
    { message: 'Provide non-empty content or at least one attachment', path: ['content'] },
  );

export class SendMessageDto extends createZodDto(SendMessageSchema) {}
