// src/modules/groups/invites.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupRole } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import {
  AppEvent,
  ConversationCreatedPayload,
  MemberAddedPayload,
} from '../../events/app-events';
import { GroupView } from '../../common/types/group-view';
import { groupInclude, memberInclude, toGroupMemberView, toGroupView } from './group-serializer';

/**
 * InvitesService — shareable invite links and link-based joining (groups.openapi.yaml).
 * This implements the **direct-join** model (the documented default, groups.md FLAG #3): a
 * valid link joins directly (201), re-joining is idempotent (200), and there is no
 * admin-approval step — so the conditional join-request endpoints are intentionally absent.
 * Link creation is admin-only (GroupRoleGuard). Persist-then-broadcast holds (NF-16).
 */
@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contacts: ContactsService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /** POST /groups/:groupId/invite-link — mint a shareable link (FR-19). Admin enforced upstream. */
  async createInviteLink(
    callerId: string,
    groupId: string,
  ): Promise<{ url: string; token: string; expiresAt: string | null }> {
    const token = randomBytes(24).toString('base64url');
    const link = await this.prisma.groupInviteLink.create({
      data: { groupId, token, createdById: callerId },
    });

    const base = this.config.get<string>('webOrigin') ?? '';
    return {
      url: `${base}/join/${link.token}`,
      token: link.token,
      expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    };
  }

  /**
   * POST /groups/join — join via an invite-link token (FR-19). Invalid/expired/exhausted
   * links → 400 INVITE_INVALID. Already a member → the group, idempotently (200). Otherwise
   * the caller joins directly (201).
   */
  async joinByLink(
    callerId: string,
    inviteToken: string,
  ): Promise<{ group: GroupView; created: boolean }> {
    const link = await this.prisma.groupInviteLink.findUnique({ where: { token: inviteToken } });
    if (
      !link ||
      (link.expiresAt && link.expiresAt.getTime() < Date.now()) ||
      (link.maxUses !== null && link.useCount >= link.maxUses)
    ) {
      throw new BadRequestException({ code: 'INVITE_INVALID', message: 'Invite link is invalid' });
    }

    if (!(await this.contacts.canInteract(callerId, link.createdById))) {
      throw new ForbiddenException({ code: 'BLOCKED', message: 'Interaction is blocked' });
    }

    const groupId = link.groupId;
    const existing = await this.prisma.member.findUnique({
      where: { userId_groupId: { userId: callerId, groupId } },
      select: { id: true },
    });
    if (existing) {
      const group = await this.loadGroup(groupId);
      return { group: toGroupView(callerId, group, true), created: false };
    }

    const member = await this.prisma.$transaction(async (tx) => {
      const created = await tx.member.create({
        data: { userId: callerId, groupId, role: GroupRole.MEMBER },
        include: memberInclude,
      });
      await tx.groupInviteLink.update({
        where: { id: link.id },
        data: { useCount: { increment: 1 } },
      });
      return created;
    });

    const group = await this.loadGroup(groupId);

    // Committed; the joiner's other devices get conversation:new, existing members member:added.
    this.events.emit(AppEvent.ConversationCreated, {
      conversationId: groupId,
      recipientIds: [callerId],
    } satisfies ConversationCreatedPayload);
    this.events.emit(AppEvent.MemberAdded, {
      groupId,
      member: toGroupMemberView(member),
    } satisfies MemberAddedPayload);

    return { group: toGroupView(callerId, group, true), created: true };
  }

  private loadGroup(groupId: string) {
    return this.prisma.group.findUniqueOrThrow({ where: { id: groupId }, include: groupInclude });
  }
}
