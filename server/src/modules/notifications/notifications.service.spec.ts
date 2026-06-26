import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType, Prisma } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppEvent } from '../../events/app-events';
import { decodeCursor } from '../../common/utils/cursor';

const actorRow = (id: string) => ({
  id,
  displayName: id,
  avatarUrl: null,
  bio: null,
  presence: 'OFFLINE',
  account: { username: id },
});

const notifRow = (over: Record<string, unknown> = {}) => ({
  id: 'n1',
  recipientId: 'u1',
  requestId: null,
  actorId: 'u2',
  type: 'FRIEND_REQUEST',
  payload: null,
  read: false,
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  actor: actorRow('u2'),
  ...over,
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: {
      findMany: jest.Mock;
      count: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
  };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue(notifRow()),
      },
    };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  describe('list', () => {
    it('serializes to the contract shape (lowercase type, actor PublicUser, merged payload)', async () => {
      prisma.notification.findMany.mockResolvedValue([
        notifRow({ requestId: 'req-1', payload: { groupId: 'g1' } }),
      ]);

      const res = await service.list('u1', 30, undefined);

      expect(res.nextCursor).toBeNull();
      expect(res.data).toEqual([
        {
          id: 'n1',
          type: 'friend_request',
          actor: {
            id: 'u2',
            username: 'u2',
            displayName: 'u2',
            avatarUrl: null,
            bio: null,
            presence: 'offline',
          },
          read: false,
          createdAt: '2026-01-02T00:00:00.000Z',
          payload: { groupId: 'g1', requestId: 'req-1' },
        },
      ]);
      // Scoped to the caller, newest first.
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'u1' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 31,
        }),
      );
    });

    it('serializes a null actor (system notification)', async () => {
      prisma.notification.findMany.mockResolvedValue([
        notifRow({ type: 'GENERIC', actorId: null, actor: null, payload: { text: 'hi' } }),
      ]);

      const res = await service.list('u1', 30, undefined);

      expect(res.data[0].actor).toBeNull();
      expect(res.data[0].type).toBe('generic');
      expect(res.data[0].payload).toEqual({ text: 'hi' });
    });

    it('emits a decodable nextCursor when a full page + 1 is returned', async () => {
      const rows = Array.from({ length: 3 }, (_, i) =>
        notifRow({ id: `n${i}`, createdAt: new Date(`2026-01-0${i + 1}T00:00:00.000Z`) }),
      );
      prisma.notification.findMany.mockResolvedValue(rows);

      const res = await service.list('u1', 2, undefined);

      expect(res.data).toHaveLength(2);
      expect(res.nextCursor).not.toBeNull();
      expect(decodeCursor(res.nextCursor)).toEqual({
        createdAt: '2026-01-02T00:00:00.000Z',
        id: 'n1',
      });
    });
  });

  describe('count', () => {
    it('counts only the caller unseen notifications', async () => {
      prisma.notification.count.mockResolvedValue(4);

      const res = await service.count('u1');

      expect(res).toEqual({ count: 4 });
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: { recipientId: 'u1', read: false },
      });
    });
  });

  describe('markSeen', () => {
    it('marks all the caller unseen notifications seen when no ids given', async () => {
      await service.markSeen('u1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 'u1', read: false },
        data: { read: true },
      });
    });

    it('scopes to the given ids (and to the caller) when ids are provided', async () => {
      await service.markSeen('u1', ['a', 'b']);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 'u1', read: false, id: { in: ['a', 'b'] } },
        data: { read: true },
      });
    });

    it('ignores an empty ids array (still marks all unseen)', async () => {
      await service.markSeen('u1', []);

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { recipientId: 'u1', read: false },
        data: { read: true },
      });
    });
  });

  describe('create', () => {
    it('persists then emits notification.created with the serialized view (NF-16)', async () => {
      prisma.notification.create.mockResolvedValue(
        notifRow({ requestId: 'req-1', payload: Prisma.JsonNull }),
      );

      const view = await service.create({
        recipientId: 'u1',
        type: NotificationType.FRIEND_REQUEST,
        actorId: 'u2',
        requestId: 'req-1',
      });

      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            recipientId: 'u1',
            type: 'FRIEND_REQUEST',
            actorId: 'u2',
            requestId: 'req-1',
            payload: Prisma.JsonNull,
          },
        }),
      );
      expect(events.emit).toHaveBeenCalledWith(AppEvent.NotificationCreated, {
        recipientId: 'u1',
        notification: view,
      });
      // Persist before broadcast (NF-16): create was invoked before emit.
      expect(prisma.notification.create.mock.invocationCallOrder[0]).toBeLessThan(
        events.emit.mock.invocationCallOrder[0],
      );
    });
  });
});
