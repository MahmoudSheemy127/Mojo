// src/modules/groups/dto/invite.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * POST /groups/:groupId/members (FR-19) — add members by id. Each must be the caller's
 * contact and not blocked. (groups.openapi.yaml#addGroupMembers)
 */
export const AddMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
});

export class AddMembersDto extends createZodDto(AddMembersSchema) {}

/**
 * POST /groups/join (FR-19) — join a group via a shared invite-link token.
 * (groups.openapi.yaml#joinByLink)
 */
export const JoinGroupSchema = z.object({
  inviteToken: z.string().min(1),
});

export class JoinGroupDto extends createZodDto(JoinGroupSchema) {}
