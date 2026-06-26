// Unit specs for the Groups domain — business rules with a mocked PrismaService,
// ContactsService, and EventEmitter2 (no DB). Asserts the contract-shaped serialization,
// the persist-then-broadcast ordering (NF-16), the contacts-only member rule, and the
// last-admin rule.
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GroupsService } from './groups.service';
import { MembersService } from './members.service';
import { ContactsService } from '../contacts/contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppEvent } from '../../events/app-events';

const userRow = (id: string) => ({
  id,
  displayName: id,
  avatarUrl: null,
  bio: null,
  presence: 'OFFLINE',
  account: { username: id },
});

const memberRow = (userId: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER') => ({
  id: `m-${userId}`,
  userId,
  groupId: 'g1',
  role,
  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
  user: userRow(userId),
});

const groupRow = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  name: 'Team',
  description: null,
  avatarUrl: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  conversationId: 'g1',
  _count: { members: 2 },
  members: [memberRow('u1', 'ADMIN'), memberRow('u2', 'MEMBER')],
  ...over,
});

describe('Groups domain', () => {
  let groups: GroupsService;
  let members: MembersService;
  let prisma: {
    conversation: { create: jest.Mock; delete: jest.Mock };
    group: { create: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    member: {
      create: jest.Mock;
      createMany: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let contacts: { canInteract: jest.Mock; areFriends: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      conversation: {
        create: jest.fn().mockResolvedValue({ id: 'g1' }),
        delete: jest.fn().mockResolvedValue({ id: 'g1' }),
      },
      group: {
        create: jest.fn().mockResolvedValue({ id: 'g1' }),
        findUnique: jest.fn().mockResolvedValue(groupRow()),
        findUniqueOrThrow: jest.fn().mockResolvedValue(groupRow()),
        update: jest.fn().mockResolvedValue(groupRow()),
      },
      member: {
        create: jest.fn().mockResolvedValue(memberRow('u3')),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(memberRow('u2', 'MEMBER')),
        delete: jest.fn().mockResolvedValue(memberRow('u2')),
        count: jest.fn().mockResolvedValue(2),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    contacts = {
      canInteract: jest.fn().mockResolvedValue(true),
      areFriends: jest.fn().mockResolvedValue(true),
    };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GroupsService,
        MembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contacts },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    groups = moduleRef.get(GroupsService);
    members = moduleRef.get(MembersService);
  });

  describe('GroupsService.create', () => {
    it('rejects a blocked member with 403 BLOCKED', async () => {
      contacts.canInteract.mockResolvedValue(false);
      await expect(groups.create('u1', { name: 'Team', memberIds: ['u2'] })).rejects.toMatchObject({
        response: { code: 'BLOCKED' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a non-contact member with 422 VALIDATION_ERROR', async () => {
      contacts.areFriends.mockResolvedValue(false);
      await expect(groups.create('u1', { name: 'Team', memberIds: ['u2'] })).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    });

    it('creates the group, makes the creator admin, and emits conversation.created after commit', async () => {
      const res = await groups.create('u1', { name: 'Team', memberIds: ['u2'] });

      expect(prisma.conversation.create).toHaveBeenCalledWith({ data: { type: 'GROUP' } });
      // group id reuses the conversation id (a group IS a conversation).
      expect(prisma.group.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ id: 'g1', conversationId: 'g1' }) }),
      );
      expect(prisma.member.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', groupId: 'g1', role: 'ADMIN' },
          { userId: 'u2', groupId: 'g1', role: 'MEMBER' },
        ],
      });
      const createOrder = prisma.member.createMany.mock.invocationCallOrder[0];
      const emitOrder = events.emit.mock.invocationCallOrder[0];
      expect(emitOrder).toBeGreaterThan(createOrder);
      expect(events.emit).toHaveBeenCalledWith(AppEvent.ConversationCreated, {
        conversationId: 'g1',
        recipientIds: ['u2'],
      });
      expect(res).toMatchObject({ id: 'g1', role: 'admin', memberCount: 2 });
      expect(res.members).toHaveLength(2);
    });

    it('does not emit conversation.created when there are no other members', async () => {
      await groups.create('u1', { name: 'Solo' });
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('GroupsService.getOne', () => {
    it('throws 404 when the group does not exist', async () => {
      prisma.group.findUnique.mockResolvedValue(null);
      await expect(groups.getOne('u1', 'g1')).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    });

    it('throws 404 (not 403) for a non-member — no existence leak', async () => {
      await expect(groups.getOne('stranger', 'g1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns the detail view (members populated) for a member', async () => {
      const res = await groups.getOne('u2', 'g1');
      expect(res).toMatchObject({ id: 'g1', role: 'member' });
      expect(res.members).toHaveLength(2);
    });
  });

  describe('GroupsService.update / delete', () => {
    it('updates and emits group.updated to all members', async () => {
      const res = await groups.update('u1', 'g1', { name: 'Renamed' });
      expect(prisma.group.update).toHaveBeenCalled();
      expect(events.emit).toHaveBeenCalledWith(AppEvent.GroupUpdated, {
        groupId: 'g1',
        recipientIds: ['u1', 'u2'],
      });
      expect(res).toMatchObject({ id: 'g1' });
    });

    it('deletes the conversation (cascade) and emits group.deleted', async () => {
      await groups.delete('g1');
      expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
      expect(events.emit).toHaveBeenCalledWith(AppEvent.GroupDeleted, { groupId: 'g1' });
    });
  });

  describe('MembersService.listMembers', () => {
    it('throws 404 when the group is missing', async () => {
      prisma.group.findUnique.mockResolvedValue(null);
      await expect(members.listMembers('u1', 'g1', 30, undefined)).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 403 when the caller is not a member', async () => {
      prisma.group.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.member.findUnique.mockResolvedValue(null);
      await expect(members.listMembers('u1', 'g1', 30, undefined)).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
    });

    it('returns paginated members for a member', async () => {
      prisma.group.findUnique.mockResolvedValue({ id: 'g1' });
      prisma.member.findUnique.mockResolvedValue({ id: 'm-u1' });
      prisma.member.findMany.mockResolvedValue([memberRow('u1', 'ADMIN'), memberRow('u2')]);
      const res = await members.listMembers('u1', 'g1', 30, undefined);
      expect(res.data).toHaveLength(2);
      expect(res.data[0]).toMatchObject({ role: 'admin', user: { id: 'u1' } });
      expect(res.nextCursor).toBeNull();
    });
  });

  describe('MembersService.addMembers', () => {
    it('rejects a blocked user with 403 BLOCKED', async () => {
      contacts.canInteract.mockResolvedValue(false);
      await expect(members.addMembers('u1', 'g1', { userIds: ['u3'] })).rejects.toMatchObject({
        response: { code: 'BLOCKED' },
      });
    });

    it('skips already-members, creates the rest, and emits after commit', async () => {
      prisma.member.findMany
        .mockResolvedValueOnce([{ userId: 'u2' }]) // existing among requested
        .mockResolvedValueOnce([memberRow('u3')]); // reloaded added
      const res = await members.addMembers('u1', 'g1', { userIds: ['u2', 'u3'] });

      expect(prisma.member.createMany).toHaveBeenCalledWith({
        data: [{ userId: 'u3', groupId: 'g1', role: 'MEMBER' }],
      });
      expect(res.added).toHaveLength(1);
      expect(res.invited).toEqual([]);
      expect(events.emit).toHaveBeenCalledWith(AppEvent.ConversationCreated, {
        conversationId: 'g1',
        recipientIds: ['u3'],
      });
      expect(events.emit).toHaveBeenCalledWith(
        AppEvent.MemberAdded,
        expect.objectContaining({ groupId: 'g1' }),
      );
    });

    it('returns empty added when every requested user is already a member', async () => {
      prisma.member.findMany.mockResolvedValueOnce([{ userId: 'u2' }]);
      const res = await members.addMembers('u1', 'g1', { userIds: ['u2'] });
      expect(res).toEqual({ added: [], invited: [] });
      expect(prisma.member.createMany).not.toHaveBeenCalled();
    });
  });

  describe('MembersService.changeRole', () => {
    it('throws 404 when the target member is not found', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      await expect(members.changeRole('u1', 'g1', 'u2', 'admin')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 409 LAST_ADMIN when demoting the only admin', async () => {
      prisma.member.findUnique.mockResolvedValue(memberRow('u1', 'ADMIN'));
      prisma.member.count.mockResolvedValue(1);
      await expect(members.changeRole('u1', 'g1', 'u1', 'member')).rejects.toMatchObject({
        response: { code: 'LAST_ADMIN' },
      });
      expect(prisma.member.update).not.toHaveBeenCalled();
    });

    it('promotes a member and emits member.role_changed', async () => {
      prisma.member.findUnique.mockResolvedValue(memberRow('u2', 'MEMBER'));
      prisma.member.update.mockResolvedValue(memberRow('u2', 'ADMIN'));
      const res = await members.changeRole('u1', 'g1', 'u2', 'admin');
      expect(res).toMatchObject({ role: 'admin', user: { id: 'u2' } });
      expect(events.emit).toHaveBeenCalledWith(AppEvent.MemberRoleChanged, {
        groupId: 'g1',
        userId: 'u2',
        role: 'admin',
      });
    });
  });

  describe('MembersService.removeMember', () => {
    it('throws 403 when the caller is not a member', async () => {
      prisma.member.findUnique.mockResolvedValue(null);
      await expect(members.removeMember('u1', 'g1', 'u2')).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
    });

    it('throws 403 when a non-admin tries to remove someone else', async () => {
      prisma.member.findUnique.mockResolvedValueOnce({ role: 'MEMBER' }); // caller
      await expect(members.removeMember('u2', 'g1', 'u1')).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
    });

    it('throws 404 when the target member is missing', async () => {
      prisma.member.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' }) // caller
        .mockResolvedValueOnce(null); // target
      await expect(members.removeMember('u1', 'g1', 'u9')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 409 LAST_ADMIN when the last admin leaves while others remain', async () => {
      prisma.member.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); // caller == self
      prisma.member.count
        .mockResolvedValueOnce(1) // admins
        .mockResolvedValueOnce(3); // total members
      await expect(members.removeMember('u1', 'g1', 'u1')).rejects.toMatchObject({
        response: { code: 'LAST_ADMIN' },
      });
      expect(prisma.member.delete).not.toHaveBeenCalled();
    });

    it('deletes the group when the sole admin leaves', async () => {
      prisma.member.findUnique.mockResolvedValueOnce({ role: 'ADMIN' }); // caller == self
      prisma.member.count
        .mockResolvedValueOnce(1) // admins
        .mockResolvedValueOnce(1); // total members
      await members.removeMember('u1', 'g1', 'u1');
      expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
      expect(events.emit).toHaveBeenCalledWith(AppEvent.GroupDeleted, { groupId: 'g1' });
    });

    it('removes a member and emits member.removed', async () => {
      prisma.member.findUnique
        .mockResolvedValueOnce({ role: 'ADMIN' }) // caller
        .mockResolvedValueOnce({ role: 'MEMBER' }); // target
      await members.removeMember('u1', 'g1', 'u2');
      expect(prisma.member.delete).toHaveBeenCalledWith({
        where: { userId_groupId: { userId: 'u2', groupId: 'g1' } },
      });
      expect(events.emit).toHaveBeenCalledWith(AppEvent.MemberRemoved, { groupId: 'g1', userId: 'u2' });
    });
  });
});
