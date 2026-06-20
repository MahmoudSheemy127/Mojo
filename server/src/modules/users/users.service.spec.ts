// src/modules/users/users.service.spec.ts
import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsersService, UploadedAvatar } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppEvent } from '../../events/app-events';

const userRow = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  displayName: 'alice',
  avatarUrl: null,
  bio: null,
  presence: 'OFFLINE',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  ...over,
});

const pngFile = (over: Partial<UploadedAvatar> = {}): UploadedAvatar => ({
  originalname: 'a.png',
  mimetype: 'image/png',
  size: 1024,
  buffer: Buffer.from('fake'),
  ...over,
});

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    account: { findUnique: jest.Mock; findMany: jest.Mock };
    user: { update: jest.Mock };
    relation: { findMany: jest.Mock; findFirst: jest.Mock };
    request: { findMany: jest.Mock };
  };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      account: { findUnique: jest.fn(), findMany: jest.fn() },
      user: { update: jest.fn().mockResolvedValue(userRow()) },
      relation: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      request: { findMany: jest.fn().mockResolvedValue([]) },
    };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('getMe', () => {
    it('returns the SelfUser with lowercased presence and ISO createdAt', async () => {
      prisma.account.findUnique.mockResolvedValue({
        username: 'alice',
        email: 'alice@example.com',
        user: userRow({ presence: 'ONLINE' }),
      });

      const me = await service.getMe('u1');

      expect(me).toEqual({
        id: 'u1',
        username: 'alice',
        displayName: 'alice',
        avatarUrl: null,
        bio: null,
        presence: 'online',
        email: 'alice@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      });
    });

    it('throws 404 NOT_FOUND when the account is missing', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.getMe('ghost')).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    });
  });

  describe('updateProfile', () => {
    it('updates only provided fields and clears bio when explicitly null', async () => {
      prisma.account.findUnique.mockResolvedValue({
        username: 'alice',
        email: 'alice@example.com',
        user: userRow(),
      });

      await service.updateProfile('u1', { displayName: 'Alice', bio: null });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { displayName: 'Alice', bio: null },
      });
    });

    it('omits fields that were not sent', async () => {
      prisma.account.findUnique.mockResolvedValue({
        username: 'alice',
        email: 'alice@example.com',
        user: userRow(),
      });

      await service.updateProfile('u1', { displayName: 'Alice' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { displayName: 'Alice' },
      });
    });
  });

  describe('setAvatar', () => {
    it('rejects a missing file with 422 VALIDATION_ERROR', async () => {
      await expect(service.setAvatar('u1', undefined)).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    });

    it('rejects a non-image mime with 422 VALIDATION_ERROR', async () => {
      await expect(
        service.setAvatar('u1', pngFile({ mimetype: 'application/pdf' })),
      ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    });

    it('rejects an oversized file with 413 FILE_TOO_LARGE', async () => {
      await expect(
        service.setAvatar('u1', pngFile({ size: 10 * 1024 * 1024 })),
      ).rejects.toMatchObject({ response: { code: 'FILE_TOO_LARGE' } });
    });

    it('stores a valid image and persists the avatarUrl', async () => {
      const res = await service.setAvatar('u1', pngFile());
      expect(res.avatarUrl).toMatch(/^\/uploads\/avatars\/u1-\d+\.png$/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { avatarUrl: res.avatarUrl },
      });
    });
  });

  describe('deleteAvatar', () => {
    it('nulls the avatarUrl', async () => {
      await service.deleteAvatar('u1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { avatarUrl: null },
      });
    });
  });

  describe('setPresence', () => {
    it('persists the uppercased enum, THEN emits presence.changed (persist-before-broadcast)', async () => {
      const order: string[] = [];
      prisma.user.update.mockImplementation(async () => {
        order.push('update');
        return userRow();
      });
      events.emit.mockImplementation(() => order.push('emit'));

      const res = await service.setPresence('u1', 'away');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { presence: 'AWAY' },
      });
      expect(events.emit).toHaveBeenCalledWith(AppEvent.PresenceChanged, {
        userId: 'u1',
        status: 'away',
      });
      expect(order).toEqual(['update', 'emit']); // NF-16: persist first
      expect(res).toEqual({ presence: 'away' });
    });
  });

  describe('search', () => {
    const account = (over: Record<string, unknown> = {}) => ({
      id: 'acc-b',
      userId: 'u2',
      username: 'bob',
      user: userRow({ id: 'u2', displayName: 'bob' }),
      ...over,
    });

    it('excludes the caller and blocked users, and returns relationship=none by default', async () => {
      prisma.relation.findMany.mockResolvedValueOnce([
        { ownerId: 'u1', relatedId: 'blocked-1' }, // caller blocked someone
      ]);
      prisma.account.findMany.mockResolvedValue([account()]);

      const res = await service.search('u1', 'bo', 30, undefined);

      const where = prisma.account.findMany.mock.calls[0][0].where;
      expect(where.userId.notIn).toEqual(['u1', 'blocked-1']);
      expect(where.username).toEqual({ contains: 'bo', mode: 'insensitive' });
      expect(res.data).toEqual([
        {
          user: {
            id: 'u2',
            username: 'bob',
            displayName: 'bob',
            avatarUrl: null,
            bio: null,
            presence: 'offline',
          },
          relationship: 'none',
        },
      ]);
      expect(res.nextCursor).toBeNull();
    });

    it('returns a nextCursor when more rows exist than the limit', async () => {
      prisma.account.findMany.mockResolvedValue([
        account({ id: 'acc-1', userId: 'u2', username: 'bob' }),
        account({ id: 'acc-2', userId: 'u3', username: 'bobby' }),
      ]);

      const res = await service.search('u1', 'bo', 1, undefined);

      expect(prisma.account.findMany.mock.calls[0][0].take).toBe(2); // limit + 1
      expect(res.data).toHaveLength(1);
      expect(res.nextCursor).not.toBeNull();
    });

    it('tags friends and pending requests', async () => {
      const acc = (id: string, username: string) => ({
        id: `acc-${id}`,
        userId: id,
        username,
        user: userRow({ id, displayName: username }),
      });
      prisma.account.findMany.mockResolvedValue([
        acc('friend', 'fa'),
        acc('sent', 'fb'),
        acc('recv', 'fc'),
      ]);
      // blockedUserIds() call + relationshipsFor() FRIEND call
      prisma.relation.findMany
        .mockResolvedValueOnce([]) // blocked ids
        .mockResolvedValueOnce([{ ownerId: 'u1', relatedId: 'friend' }]); // friends
      prisma.request.findMany.mockResolvedValue([
        { sourceUserId: 'u1', targetUserId: 'sent' },
        { sourceUserId: 'recv', targetUserId: 'u1' },
      ]);

      const res = await service.search('u1', 'f', 30, undefined);
      const rel = Object.fromEntries(res.data.map((r) => [r.user.id, r.relationship]));
      expect(rel).toEqual({ friend: 'friends', sent: 'request_sent', recv: 'request_received' });
    });
  });

  describe('getPublic', () => {
    it('returns the PublicUser for an existing, non-blocked user', async () => {
      prisma.account.findUnique.mockResolvedValue({
        username: 'bob',
        user: userRow({ id: 'u2', displayName: 'bob' }),
      });

      const res = await service.getPublic('u1', 'u2');
      expect(res).toEqual({
        id: 'u2',
        username: 'bob',
        displayName: 'bob',
        avatarUrl: null,
        bio: null,
        presence: 'offline',
      });
    });

    it('throws 404 when the user does not exist', async () => {
      prisma.account.findUnique.mockResolvedValue(null);
      await expect(service.getPublic('u1', 'ghost')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('hides a blocked user behind a 404 (no existence leak)', async () => {
      prisma.account.findUnique.mockResolvedValue({
        username: 'bob',
        user: userRow({ id: 'u2' }),
      });
      prisma.relation.findFirst.mockResolvedValue({ id: 'rel-1' }); // a block exists

      await expect(service.getPublic('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });
  });
});
