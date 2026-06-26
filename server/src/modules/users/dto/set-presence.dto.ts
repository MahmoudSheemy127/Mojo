// src/modules/users/dto/set-presence.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * PATCH /users/me/presence (FR-10). `offline` is set automatically by the server on
 * socket disconnect — it is NOT settable here (users.openapi.yaml), so the enum is
 * restricted to the explicit choices.
 */
export const SetPresenceSchema = z.object({
  status: z.enum(['online', 'away', 'dnd']),
});

export class SetPresenceDto extends createZodDto(SetPresenceSchema) {}
