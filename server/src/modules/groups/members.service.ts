// src/modules/groups/members.service.ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor';
import {
  AppEvent,
  ConversationCreatedPayload,
  GroupDeletedPayload,
  MemberAddedPayload,
  MemberRemovedPayload,
  MemberRoleChangedPayload,
} from '../../events/app-events';
import { GroupMemberView } from '../../common/types/group-view';
import { Paginated } from '../../common/types/conversation-view';
import { AddMembersDto } from './dto/invite.dto';
import { memberInclude, toGroupMemberView } from './group-serializer';

/** Keyset cursor for the member list: paginate over the membership row id. */
interface MemberCursor {
  id: string;
}

/**
 * MembersService — group membership and roles (groups.openapi.yaml): list members, add
 * members (admin), change a member's role (admin, last-admin guarded), and remove/leave.
 * Admin-only routes are gated upstream by GroupRoleGuard; the remove/leave route branches on
 * the target so its authorization lives here. The **last-admin rule** is enforced as a hard
 * 409 LAST_ADMIN (a group is never left without an admin); the sole remaining member leaving
 * deletes the group. Events are emitted only after the write commits (NF-16).
 */
@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly events: EventEmitter2,
  ) {}

  /** GET /groups/:groupId/members — paginated members; members only (403 otherwise). */
  async listMembers(
    callerId: string,
    groupId: string,
    limit: number,
    cursor: string | undefined,
  ): Promise<Paginated<GroupMemberView>> {
    const group = await this.prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Group not found' });
    await this.assertMember(callerId, groupId);

    const after = decodeCursor<MemberCursor>(cursor);
    const rows = await this.prisma.member.findMany({
      where: { groupId, ...(after ? { id: { gt: after.id } } : {}) },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: memberInclude,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last ? encodeCursor<MemberCursor>({ id: last.id }) : null;

    return { data: page.map(toGroupMemberView), nextCursor };
  }

  /**
   * POST /groups/:groupId/members — add members by id (FR-19). Admin is enforced by
   * GroupRoleGuard. Each id must be the caller's contact and not blocked; already-members
   * are skipped. Under the direct-join model every valid id joins directly, so `invited` is
   * always empty (it carries weight only under an admin-approval model).
   */
  async addMembers(
    callerId: string,
    groupId: string,
    dto: AddMembersDto,
  ): Promise<{ added: GroupMemberView[]; invited: [] }> {
    const requested = [...new Set(dto.userIds)].filter((id) => id !== callerId);
    await this.assertAllContacts(callerId, requested);

    const existing = await this.prisma.member.findMany({
      where: { groupId, userId: { in: requested } },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((m) => m.userId));
    const toAdd = requested.filter((id) => !existingIds.has(id));

    if (toAdd.length === 0) return { added: [], invited: [] };

    const added = await this.prisma.$transaction(async (tx) => {
      await tx.member.createMany({
        data: toAdd.map((userId) => ({ userId, groupId, role: GroupRole.MEMBER })),
      });
      return tx.member.findMany({
        where: { groupId, userId: { in: toAdd } },
        include: memberInclude,
      });
    });

    const addedViews = added.map(toGroupMemberView);
    // The new members get the conversation in their list; existing members see member:added.
    this.events.emit(AppEvent.ConversationCreated, {
      conversationId: groupId,
      recipientIds: toAdd,
    } satisfies ConversationCreatedPayload);
    for (const member of addedViews) {
      this.events.emit(AppEvent.MemberAdded, {
        groupId,
        member,
      } satisfies MemberAddedPayload);
    }

    return { added: addedViews, invited: [] };
  }

  /**
   * PATCH /groups/:groupId/members/:userId — change a member's role (FR-20). Admin enforced
   * by GroupRoleGuard. Demoting the last remaining admin is rejected with 409 LAST_ADMIN.
   */
  async changeRole(
    callerId: string,
    groupId: string,
    userId: string,
    role: 'admin' | 'member',
  ): Promise<GroupMemberView> {
    const target = await this.prisma.member.findUnique({
      where: { userId_groupId: { userId, groupId } },
      include: memberInclude,
    });
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Member not found' });

    const nextRole = role === 'admin' ? GroupRole.ADMIN : GroupRole.MEMBER;
    if (target.role === GroupRole.ADMIN && nextRole === GroupRole.MEMBER) {
      await this.assertNotLastAdmin(groupId);
    }

    const updated = await this.prisma.member.update({
      where: { userId_groupId: { userId, groupId } },
      data: { role: nextRole },
      include: memberInclude,
    });

    this.events.emit(AppEvent.MemberRoleChanged, {
      groupId,
      userId,
      role,
    } satisfies MemberRoleChangedPayload);

    return toGroupMemberView(updated);
  }

  /**
   * DELETE /groups/:groupId/members/:userId — remove a member (FR-21) or leave (FR-22). One
   * endpoint, authorization branches on the target: removing someone else requires admin;
   * leaving (self) is allowed for any member. The last admin cannot be removed/leave while
   * other members remain (409 LAST_ADMIN); the sole remaining member leaving deletes the
   * group.
   */
  async removeMember(callerId: string, groupId: string, userId: string): Promise<void> {
    const caller = await this.prisma.member.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
      select: { role: true },
    });
    if (!caller) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not a group member' });

    const isSelf = userId === callerId;
    if (!isSelf && caller.role !== GroupRole.ADMIN) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only admins can remove other members',
      });
    }

    const target = isSelf
      ? caller
      : await this.prisma.member.findUnique({
          where: { userId_groupId: { userId, groupId } },
          select: { role: true },
        });
    if (!target) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Member not found' });

    if (target.role === GroupRole.ADMIN) {
      const [adminCount, memberCount] = await Promise.all([
        this.prisma.member.count({ where: { groupId, role: GroupRole.ADMIN } }),
        this.prisma.member.count({ where: { groupId } }),
      ]);
      if (adminCount === 1) {
        if (memberCount > 1) {
          throw new ConflictException({
            code: 'LAST_ADMIN',
            message: 'Promote another admin before removing the last one',
          });
        }
        // Sole member is the last admin: leaving dissolves the group entirely.
        await this.prisma.conversation.delete({ where: { id: groupId } });
        this.events.emit(AppEvent.GroupDeleted, { groupId } satisfies GroupDeletedPayload);
        return;
      }
    }

    await this.prisma.member.delete({ where: { userId_groupId: { userId, groupId } } });
    this.events.emit(AppEvent.MemberRemoved, {
      groupId,
      userId,
    } satisfies MemberRemovedPayload);
  }

  // ── helpers ──────────────────────────────────────────────────────

  private async assertMember(userId: string, groupId: string): Promise<void> {
    const member = await this.prisma.member.findUnique({
      where: { userId_groupId: { userId, groupId } },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Not a group member' });
    }
  }

  private async assertNotLastAdmin(groupId: string): Promise<void> {
    const adminCount = await this.prisma.member.count({
      where: { groupId, role: GroupRole.ADMIN },
    });
    if (adminCount <= 1) {
      throw new ConflictException({
        code: 'LAST_ADMIN',
        message: 'A group must keep at least one admin',
      });
    }
  }

  private async assertAllContacts(callerId: string, userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      if (!(await this.contacts.canInteract(callerId, userId))) {
        throw new ForbiddenException({ code: 'BLOCKED', message: 'Interaction is blocked' });
      }
      if (!(await this.contacts.areFriends(callerId, userId))) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          message: 'Members must be your contacts',
        });
      }
    }
  }
}
