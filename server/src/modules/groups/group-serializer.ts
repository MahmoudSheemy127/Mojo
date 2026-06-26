// src/modules/groups/group-serializer.ts
// Shared Prisma selects + contract serializers for the Groups domain, used by
// GroupsService / MembersService / InvitesService so every surface emits the exact same
// Group / GroupMember shape (docs/contract/_common.yaml).
import { Prisma } from '@prisma/client';
import { PresenceStatus } from '../../events/app-events';
import { PublicUserView } from '../../common/types/conversation-view';
import { GroupMemberView, GroupView } from '../../common/types/group-view';

/** Profile fields + username needed to build a PublicUser. */
export const userPublicSelect = {
  id: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  presence: true,
  account: { select: { username: true } },
} satisfies Prisma.UserSelect;

type UserPublicRow = Prisma.UserGetPayload<{ select: typeof userPublicSelect }>;

/** A Member row with its user populated — the input the GroupMember serializer needs. */
export const memberInclude = {
  user: { select: userPublicSelect },
} satisfies Prisma.MemberInclude;

export type MemberWithUser = Prisma.MemberGetPayload<{ include: typeof memberInclude }>;

/** Everything a GroupView needs: every member (with user) + the member count. */
export const groupInclude = {
  members: { include: memberInclude, orderBy: { joinedAt: 'asc' } },
  _count: { select: { members: true } },
} satisfies Prisma.GroupInclude;

export type GroupRow = Prisma.GroupGetPayload<{ include: typeof groupInclude }>;

export function toPublicUser(user: UserPublicRow): PublicUserView {
  return {
    id: user.id,
    username: user.account?.username ?? '',
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    presence: user.presence.toLowerCase() as PresenceStatus,
  };
}

export function toGroupMemberView(member: MemberWithUser): GroupMemberView {
  return {
    user: toPublicUser(member.user),
    role: member.role.toLowerCase() as 'admin' | 'member',
    joinedAt: member.joinedAt.toISOString(),
  };
}

/**
 * Serialize a Group for a specific viewer (the contract's `role` is the viewer's own role).
 * `members` is populated only on the detail endpoint, so it is opt-in.
 */
export function toGroupView(viewerId: string, row: GroupRow, includeMembers: boolean): GroupView {
  const mine = row.members.find((m) => m.userId === viewerId);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatarUrl,
    createdAt: row.createdAt.toISOString(),
    memberCount: row._count.members,
    role: (mine?.role ?? 'MEMBER').toLowerCase() as 'admin' | 'member',
    ...(includeMembers ? { members: row.members.map(toGroupMemberView) } : {}),
  };
}
