// src/modules/contacts/contacts.service.spec.ts
import { Test } from '@nestjs/testing';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const userRow = (over: Record<string, unknown> = {}) => ({
  id: 'u2',
  displayName: 'bob',
  avatarUrl: null,
  bio: null,
  presence: 'OFFLINE',
  account: { username: 'bob' },
  ...over,
});

const requestRow = (over: Record<string, unknown> = {}) => ({
  id: 'req-1',
  sourceUserId: 'u2',
  targetUserId: 'u1',
  type: 'FRIEND_REQUEST',
  status: 'PENDING',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  sourceUser: userRow({ id: 'u2', account: { username: 'bob' } }),
  targetUser: userRow({ id: 'u1', displayName: 'alice', account: { username: 'alice' } }),
  ...over,
});

describe('ContactsService', () => {
  let service: ContactsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    relation: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    request: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let notifications: {
    removeNotification(removeNotification: any): unknown; create: jest.Mock 
};

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      relation: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'rel-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'rel-1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      request: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(requestRow()),
        update: jest.fn().mockResolvedValue(requestRow()),
        delete: jest.fn().mockResolvedValue(requestRow()),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      // Run the callback with the same mock object acting as the tx client.
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };

    notifications = { create: jest.fn().mockResolvedValue(undefined), removeNotification: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = moduleRef.get(ContactsService);
  });

  describe('listFriends', () => {
    it('maps each relation to the OTHER user and returns no cursor under the limit', async () => {
      prisma.relation.findMany.mockResolvedValue([
        {
          id: 'r1',
          ownerId: 'u1',
          relatedId: 'u2',
          owner: userRow({ id: 'u1', account: { username: 'alice' } }),
          related: userRow({ id: 'u2', account: { username: 'bob' } }),
        },
      ]);

      const res = await service.listFriends('u1', 30, undefined);

      expect(res.data).toEqual([
        {
          id: 'u2',
          username: 'bob',
          displayName: 'bob',
          avatarUrl: null,
          bio: null,
          presence: 'offline',
        },
      ]);
      expect(res.nextCursor).toBeNull();
    });

    it('returns a nextCursor when more rows exist than the limit', async () => {
      prisma.relation.findMany.mockResolvedValue([
        { id: 'r1', ownerId: 'u1', relatedId: 'u2', owner: userRow({ id: 'u1' }), related: userRow({ id: 'u2' }) },
        { id: 'r2', ownerId: 'u3', relatedId: 'u1', owner: userRow({ id: 'u3' }), related: userRow({ id: 'u1' }) },
      ]);

      const res = await service.listFriends('u1', 1, undefined);

      expect(prisma.relation.findMany.mock.calls[0][0].take).toBe(2); // limit + 1
      expect(res.data).toHaveLength(1);
      expect(res.nextCursor).not.toBeNull();
    });
  });

  describe('listRequests', () => {
    it('splits pending requests into incoming and outgoing', async () => {
      prisma.request.findMany.mockResolvedValue([
        requestRow({ id: 'in', sourceUserId: 'u2', targetUserId: 'u1' }),
        requestRow({ id: 'out', sourceUserId: 'u1', targetUserId: 'u3' }),
      ]);

      const res = await service.listRequests('u1');

      expect(res.incoming.map((r) => r.id)).toEqual(['in']);
      expect(res.outgoing.map((r) => r.id)).toEqual(['out']);
      expect(res.incoming[0]).toMatchObject({ id: 'in', from: { id: 'u2' }, to: { id: 'u1' } });
    });
  });

  describe('sendRequest', () => {
    it('rejects sending a request to yourself with 422', async () => {
      await expect(service.sendRequest('u1', 'u1')).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    });

    it('throws 404 when the target does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.sendRequest('u1', 'ghost')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 403 BLOCKED when a block exists either direction', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findFirst.mockResolvedValueOnce({ id: 'blk' }); // block check
      await expect(service.sendRequest('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'BLOCKED' },
      });
    });

    it('throws 409 ALREADY_FRIENDS when a friendship exists', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findFirst
        .mockResolvedValueOnce(null) // block check
        .mockResolvedValueOnce({ id: 'fr' }); // friendship check
      await expect(service.sendRequest('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'ALREADY_FRIENDS' },
      });
    });

    it('auto-accepts a mutual request: accepts the reverse and creates the friendship edge', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findFirst.mockResolvedValue(null); // no block, no friendship
      prisma.request.findFirst.mockResolvedValueOnce(
        requestRow({ id: 'reverse', sourceUserId: 'u2', targetUserId: 'u1' }),
      );

      const res = await service.sendRequest('u1', 'u2');

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 'reverse' },
        data: { status: 'ACCEPTED', respondedAt: expect.any(Date) },
      });
      expect(prisma.relation.create).toHaveBeenCalledWith({
        data: { ownerId: 'u1', relatedId: 'u2', type: 'FRIEND' },
      });
      expect(notifications.create).toHaveBeenCalledWith({
        recipientId: 'u2', // the original requester (reverse.sourceUserId)
        type: 'FRIEND_REQUEST_ACCEPTED',
        actorId: 'u1',
      });
      expect(res.id).toBe('reverse');
    });

    it('throws 409 REQUEST_EXISTS when the caller already has a pending request', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findFirst.mockResolvedValue(null);
      prisma.request.findFirst
        .mockResolvedValueOnce(null) // no reverse
        .mockResolvedValueOnce({ id: 'dup' }); // existing own request
      await expect(service.sendRequest('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'REQUEST_EXISTS' },
      });
    });

    it('creates a pending request and returns the ContactRequest', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findFirst.mockResolvedValue(null);
      prisma.request.findFirst.mockResolvedValue(null);
      prisma.request.create.mockResolvedValue(
        requestRow({
          id: 'new',
          sourceUserId: 'u1',
          targetUserId: 'u2',
          sourceUser: userRow({ id: 'u1', account: { username: 'alice' } }),
          targetUser: userRow({ id: 'u2', account: { username: 'bob' } }),
        }),
      );

      const res = await service.sendRequest('u1', 'u2');

      expect(prisma.request.create).toHaveBeenCalledWith({
        data: { sourceUserId: 'u1', targetUserId: 'u2', type: 'FRIEND_REQUEST' },
        include: expect.any(Object),
      });
      expect(notifications.create).toHaveBeenCalledWith({
        recipientId: 'u2',
        type: 'FRIEND_REQUEST',
        actorId: 'u1',
        requestId: 'new',
      });
      // actor is resolved from actorId server-side; it must NOT be duplicated into payload.
      expect(notifications.create.mock.calls[0][0]).not.toHaveProperty('payload.actor');
      expect(res).toMatchObject({ id: 'new', from: { id: 'u1' }, to: { id: 'u2' } });
    });
  });

  describe('acceptRequest', () => {
    it('throws 404 when the request is missing or not pending', async () => {
      prisma.request.findUnique.mockResolvedValue(null);
      await expect(service.acceptRequest('u1', 'req-1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 403 when the caller is not the recipient', async () => {
      prisma.request.findUnique.mockResolvedValue(requestRow({ targetUserId: 'someone-else' }));
      await expect(service.acceptRequest('u1', 'req-1')).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
    });

    it('accepts the request and creates the friendship, returning the requester', async () => {
      prisma.request.findUnique.mockResolvedValue(
        requestRow({ sourceUserId: 'u2', targetUserId: 'u1' }),
      );
      prisma.relation.findFirst.mockResolvedValue(null); // no pre-existing edge

      const res = await service.acceptRequest('u1', 'req-1');

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'ACCEPTED', respondedAt: expect.any(Date) },
      });
      expect(prisma.relation.create).toHaveBeenCalledWith({
        data: { ownerId: 'u2', relatedId: 'u1', type: 'FRIEND' },
      });
      expect(notifications.create).toHaveBeenCalledWith({
        recipientId: 'u2', // the original requester (request.sourceUserId)
        type: 'FRIEND_REQUEST_ACCEPTED',
        actorId: 'u1', // the acceptor
      });
      expect(notifications.removeNotification).toHaveBeenCalledWith('req-1'); // Remove the notification related to the friend request
      expect(res.friend).toMatchObject({ id: 'u2', username: 'bob' });
    });
  });

  describe('declineRequest', () => {
    it('throws 403 when the caller is not the recipient', async () => {
      prisma.request.findUnique.mockResolvedValue(requestRow({ targetUserId: 'x' }));
      await expect(service.declineRequest('u1', 'req-1')).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
    });

    it('deletes the pending request', async () => {
      prisma.request.findUnique.mockResolvedValue(requestRow({ targetUserId: 'u1' }));
      await service.declineRequest('u1', 'req-1');
      expect(prisma.request.delete).toHaveBeenCalledWith({ where: { id: 'req-1' } });
    });
  });

  describe('removeContact', () => {
    it('throws 404 when there is no friendship', async () => {
      prisma.relation.findFirst.mockResolvedValue(null);
      await expect(service.removeContact('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('deletes the friendship edge', async () => {
      prisma.relation.findFirst.mockResolvedValue({ id: 'fr-1' });
      await service.removeContact('u1', 'u2');
      expect(prisma.relation.delete).toHaveBeenCalledWith({ where: { id: 'fr-1' } });
    });
  });

  describe('blockUser', () => {
    it('rejects blocking yourself with 422', async () => {
      await expect(service.blockUser('u1', 'u1')).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    });

    it('throws 409 ALREADY_BLOCKED when a block already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findUnique.mockResolvedValue({ id: 'blk' });
      await expect(service.blockUser('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'ALREADY_BLOCKED' },
      });
    });

    it('creates the block and drops friendship + pending requests both ways', async () => {
      prisma.user.findUnique.mockResolvedValue(userRow());
      prisma.relation.findUnique.mockResolvedValue(null);

      const res = await service.blockUser('u1', 'u2');

      expect(prisma.relation.create).toHaveBeenCalledWith({
        data: { ownerId: 'u1', relatedId: 'u2', type: 'BLOCK' },
      });
      expect(prisma.relation.deleteMany).toHaveBeenCalledWith({
        where: {
          type: 'FRIEND',
          OR: [
            { ownerId: 'u1', relatedId: 'u2' },
            { ownerId: 'u2', relatedId: 'u1' },
          ],
        },
      });
      expect(prisma.request.deleteMany).toHaveBeenCalled();
      expect(res.blockedUser).toMatchObject({ id: 'u2', username: 'bob' });
    });
  });

  describe('listBlocked', () => {
    it('maps the related user of each BLOCK row', async () => {
      prisma.relation.findMany.mockResolvedValue([
        { id: 'b1', relatedId: 'u2', related: userRow({ id: 'u2' }) },
      ]);

      const res = await service.listBlocked('u1', 30, undefined);

      expect(prisma.relation.findMany.mock.calls[0][0].where).toMatchObject({
        type: 'BLOCK',
        ownerId: 'u1',
      });
      expect(res.data).toEqual([
        { id: 'u2', username: 'bob', displayName: 'bob', avatarUrl: null, bio: null, presence: 'offline' },
      ]);
    });
  });

  describe('unblockUser', () => {
    it('throws 404 when the user is not blocked', async () => {
      prisma.relation.findUnique.mockResolvedValue(null);
      await expect(service.unblockUser('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('deletes the block edge', async () => {
      prisma.relation.findUnique.mockResolvedValue({ id: 'blk-1' });
      await service.unblockUser('u1', 'u2');
      expect(prisma.relation.delete).toHaveBeenCalledWith({ where: { id: 'blk-1' } });
    });
  });

  describe('canInteract', () => {
    it('returns false when a block exists either direction', async () => {
      prisma.relation.findFirst.mockResolvedValue({ id: 'blk' });
      expect(await service.canInteract('u1', 'u2')).toBe(false);
    });

    it('returns true when no block exists', async () => {
      prisma.relation.findFirst.mockResolvedValue(null);
      expect(await service.canInteract('u1', 'u2')).toBe(true);
    });
  });
});
