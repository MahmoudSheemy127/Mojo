// src/modules/contacts/dto/send-request.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /contacts/requests (FR-06). The body carries the target user's id; the
 * caller is taken from the access token. (contacts.openapi.yaml#sendFriendRequest)
 */
export const SendRequestSchema = z.object({
  userId: z.string().uuid(),
});

export class SendRequestDto extends createZodDto(SendRequestSchema) {}
