// src/common/guards/group-role.guard.ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GroupRole } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthUser } from '../decorators/current-user.decorator';
import { GROUP_ROLES_KEY } from '../decorators/group-roles.decorator';

/**
 * Authorizes admin-only group endpoints (backend-design-nestjs.md §5). Reads the
 * `:groupId` path param, looks up the caller's `Member.role`, and throws 403 FORBIDDEN
 * unless it matches one of the roles required by `@GroupRoles(...)`. Non-members (and
 * unknown groups) are 403 too — existence is never leaked. Runs after the global
 * JwtAuthGuard, so `request.user` is always populated. Since a group's id equals its
 * conversation id, `:groupId` is also the Member.groupId lookup key.
 */
@Injectable()
export class GroupRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<GroupRole[] | undefined>(
      GROUP_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    // No @GroupRoles on the route → the guard is a no-op (membership is enforced elsewhere).
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const groupId = request.params.groupId;
    const userId = request.user.id;

    const member = await this.prisma.member.findUnique({
      where: { userId_groupId: { userId, groupId } },
      select: { role: true },
    });

    if (!member || !required.includes(member.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action',
      });
    }
    return true;
  }
}
