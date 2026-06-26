// src/modules/groups/dto/change-role.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * PATCH /groups/:groupId/members/:userId (FR-20). Body carries the contract GroupRole
 * (lowercase); the service maps it to the Prisma enum. (groups.openapi.yaml#changeMemberRole)
 */
export const ChangeRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

export class ChangeRoleDto extends createZodDto(ChangeRoleSchema) {}
