// src/common/decorators/group-roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { GroupRole } from '@prisma/client';

export const GROUP_ROLES_KEY = 'groupRoles';

/**
 * Restrict a group route to members holding one of the given roles (FR-20/21/23).
 * Read by GroupRoleGuard, which resolves the caller's Member.role for the `:groupId`
 * path param. e.g. `@GroupRoles('ADMIN')` on admin-only endpoints.
 */
export const GroupRoles = (...roles: GroupRole[]) => SetMetadata(GROUP_ROLES_KEY, roles);
