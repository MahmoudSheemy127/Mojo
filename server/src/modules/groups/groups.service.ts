// src/modules/groups/groups.service.ts
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConversationType, GroupRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import {
  AppEvent,
  ConversationCreatedPayload,
  GroupDeletedPayload,
  GroupUpdatedPayload,
} from '../../events/app-events';
import { GroupView } from '../../common/types/group-view';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { groupInclude, GroupRow, toGroupView } from './group-serializer';

/**
 * GroupsService — group lifecycle (groups.openapi.yaml): create (creator becomes the first
 * admin, contacts-only members), fetch detail (membership-gated), admin profile edit, and
 * admin delete. A group **is** a conversation — we create the Conversation first and reuse
 * its id as the Group id, so the same id flows through messages, conversations, and the
 * `:groupId` path params. Domain events are emitted only AFTER the DB transaction commits
 * (persist-then-broadcast, NF-16); RealtimeModule turns them into socket broadcasts.
 */
@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly events: EventEmitter2,
  ) {}

  /** POST /groups — create a group; the caller is its first admin (FR-18). */
  async create(callerId: string, dto: CreateGroupDto): Promise<GroupView> {
    const memberIds = [...new Set(dto.memberIds ?? [])].filter((id) => id !== callerId);
    await this.assertAllContacts(callerId, memberIds);

    const group = await this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: { type: ConversationType.GROUP },
      });
      // A group IS a conversation: reuse the conversation id as the group id.
      const created = await tx.group.create({
        data: {
          id: conversation.id,
          conversationId: conversation.id,
          name: dto.name,
          description: dto.description ?? null,
        },
      });
      await tx.member.createMany({
        data: [
          { userId: callerId, groupId: created.id, role: GroupRole.ADMIN },
          ...memberIds.map((userId) => ({ userId, groupId: created.id, role: GroupRole.MEMBER })),
        ],
      });
      return tx.group.findUniqueOrThrow({ where: { id: created.id }, include: groupInclude });
    });

    // Committed; the other members get the conversation in their list via `conversation:new`.
    if (memberIds.length > 0) {
      this.events.emit(AppEvent.ConversationCreated, {
        conversationId: group.id,
        recipientIds: memberIds,
      } satisfies ConversationCreatedPayload);
    }

    return toGroupView(callerId, group, true);
  }

  /**
   * GET /groups/:groupId — group detail with members populated. Non-members get a 404 (not
   * 403) so existence is not leaked (NF-13).
   */
  async getOne(callerId: string, groupId: string): Promise<GroupView> {
    const group = await this.findGroup(groupId);
    if (!group || !this.isMember(callerId, group)) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Group not found' });
    }
    return toGroupView(callerId, group, true);
  }

  /**
   * PATCH /groups/:groupId — admin profile edit (FR-23). The GroupRoleGuard has already
   * verified the caller is an admin of this group.
   */
  async update(callerId: string, groupId: string, dto: UpdateGroupDto): Promise<GroupView> {
    const updated = await this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        // avatarId references an uploaded attachment; `null` clears it.
        ...(dto.avatarId !== undefined ? { avatarUrl: null } : {}),
      },
      include: groupInclude,
    });

    this.events.emit(AppEvent.GroupUpdated, {
      groupId,
      recipientIds: updated.members.map((m) => m.userId),
    } satisfies GroupUpdatedPayload);

    return toGroupView(callerId, updated, true);
  }

  /**
   * DELETE /groups/:groupId — admin delete (FR-18 lifecycle). Deleting the Conversation
   * cascades to the Group, its Members, and messages. Admin is enforced by GroupRoleGuard.
   */
  async delete(groupId: string): Promise<void> {
    // group.id === conversation.id; deleting the conversation cascades the whole group.
    await this.prisma.conversation.delete({ where: { id: groupId } });
    this.events.emit(AppEvent.GroupDeleted, { groupId } satisfies GroupDeletedPayload);
  }

  // ── helpers ──────────────────────────────────────────────────────

  private findGroup(groupId: string): Promise<GroupRow | null> {
    return this.prisma.group.findUnique({ where: { id: groupId }, include: groupInclude });
  }

  private isMember(userId: string, group: GroupRow): boolean {
    return group.members.some((m) => m.userId === userId);
  }

  /**
   * Every prospective member must be the caller's contact and not blocked (groups.md):
   * blocked → 403 BLOCKED; not a contact (incl. unknown user) → 422 VALIDATION_ERROR.
   */
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
