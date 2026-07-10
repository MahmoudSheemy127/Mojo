import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { decodeTime, ulid } from 'ulid';
import { ConversationsService } from './conversations.service';
import { ContactsService } from '../contacts/contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppEvent } from '../../events/app-events';

const userRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  displayName: id,
  avatarUrl: null,
  bio: null,
  presence: 'OFFLINE',
  account: { username: id },
  ...over,
});

const dmRow = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  type: 'DM',
  dmKey: 'u1:u2',
  lastActivityAt: new Date('2026-01-02T00:00:00.000Z'),
  lastMessageId: null,
  lastMessage: null,
  userChats: [
    { userId: 'u1', user: userRow('u1') },
    { userId: 'u2', user: userRow('u2') },
  ],
  group: null,
  reads: [],
  ...over,
});

const groupRow = (over: Record<string, unknown> = {}) => ({
  id: 'g-conv',
  type: 'GROUP',
  dmKey: null,
  lastActivityAt: new Date('2026-01-03T00:00:00.000Z'),
  lastMessageId: null,
  lastMessage: null,
  userChats: [],
  group: {
    name: 'Team',
    avatarUrl: null,
    _count: { members: 3 },
    members: [
      {
        userId: '3c0377c4-6066-4a72-aef7-ae3129380cd6',
        role: 'MEMBER',
        user: {
          id: '3c0377c4-6066-4a72-aef7-ae3129380cd6',
          displayName: 'ahmed120',
          avatarUrl: null,
          bio: null,
          presence: 'ONLINE',
          account: { username: 'ahmed120' },
        },
      },
      { userId: 'u1', role: 'ADMIN', user: userRow('u1') },
      { userId: 'u2', role: 'MEMBER', user: userRow('u2') },
    ],
  },
  reads: [],
  ...over,
});

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: {
    conversation: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
    userChat: { createMany: jest.Mock };
    user: { findUnique: jest.Mock };
    relation: { findFirst: jest.Mock };
    message: { count: jest.Mock; findFirst: jest.Mock };
    conversationRead: { upsert: jest.Mock };
    $transaction: jest.Mock;
  };
  let contacts: { canInteract: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      conversation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
      userChat: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u2' }) },
      relation: { findFirst: jest.fn().mockResolvedValue({ id: 'fr' }) },
      message: { count: jest.fn().mockResolvedValue(0), findFirst: jest.fn().mockResolvedValue(null) },
      conversationRead: { upsert: jest.fn().mockResolvedValue({ id: 'read-1' }) },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    contacts = { canInteract: jest.fn().mockResolvedValue(true) };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contacts },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(ConversationsService);
  });

  describe('list', () => {
    it('serializes a DM with the OTHER user and computes unreadCount', async () => {
      prisma.conversation.findMany.mockResolvedValue([dmRow()]);
      prisma.message.count.mockResolvedValue(4);

      const res = await service.list('u1', 30, undefined);

      expect(res.nextCursor).toBeNull();
      expect(res.data).toEqual([
        {
          id: 'c1',
          type: 'dm',
          lastMessage: null,
          lastActivityAt: '2026-01-02T00:00:00.000Z',
          unreadCount: 4,
          otherUser: {
            id: 'u2',
            username: 'u2',
            displayName: 'u2',
            avatarUrl: null,
            bio: null,
            presence: 'offline',
          },
        },
      ]);
      // unread excludes the caller's own messages and respects the read marker.
      expect(prisma.message.count.mock.calls[0][0].where).toMatchObject({
        conversationId: 'c1',
        senderId: { not: 'u1' },
        deletedAt: null,
      });
    });

    it('serializes a group with memberCount and the caller role', async () => {
      prisma.conversation.findMany.mockResolvedValue([groupRow()]);

      const res = await service.list('u1', 30, undefined);

      expect(res.data[0]).toMatchObject({
        type: 'group',
        name: 'Team',
        memberCount: 3,
        role: 'admin',
        members: expect.arrayContaining([
          {
            id: '3c0377c4-6066-4a72-aef7-ae3129380cd6',
            username: 'ahmed120',
            displayName: 'ahmed120',
            avatarUrl: null,
            bio: null,
            presence: 'online',
          },
        ]),
      });
    });

    it('returns a nextCursor when more rows than the limit exist', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        dmRow({ id: 'c1' }),
        dmRow({ id: 'c2' }),
      ]);

      const res = await service.list('u1', 1, undefined);

      expect(prisma.conversation.findMany.mock.calls[0][0].take).toBe(2); // limit + 1
      expect(res.data).toHaveLength(1);
      expect(res.nextCursor).not.toBeNull();
    });

    it('maps a lastMessage to the contract Message shape (sequence from ULID)', async () => {
      const id = ulid();
      prisma.conversation.findMany.mockResolvedValue([
        dmRow({
          lastMessage: {
            id,
            conversationId: 'c1',
            senderId: 'u2',
            content: 'hi',
            createdAt: new Date('2026-01-02T00:00:00.000Z'),
            deletedAt: null,
            attachments: [],
          },
        }),
      ]);

      const res = await service.list('u1', 30, undefined);

      expect(res.data[0].lastMessage).toEqual({
        id,
        conversationId: 'c1',
        sequence: decodeTime(id),
        senderId: 'u2',
        content: 'hi',
        attachments: [],
        status: 'sent',
        createdAt: '2026-01-02T00:00:00.000Z',
        deletedAt: null,
      });
    });
  });

  describe('getOne', () => {
    it('throws 404 when the conversation does not exist', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.getOne('u1', 'c1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 404 (not 403) when the caller is not a participant — no existence leak', async () => {
      prisma.conversation.findUnique.mockResolvedValue(dmRow({ userChats: [{ userId: 'x', user: userRow('x') }, { userId: 'y', user: userRow('y') }] }));
      await expect(service.getOne('u1', 'c1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns the view for a participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(dmRow());
      const res = await service.getOne('u1', 'c1');
      expect(res).toMatchObject({ id: 'c1', type: 'dm', otherUser: { id: 'u2' } });
    });
  });

  describe('openDm', () => {
    it('rejects opening a DM with yourself (422)', async () => {
      await expect(service.openDm('u1', 'u1')).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    });

    it('throws 404 when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.openDm('u1', 'ghost')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 403 BLOCKED when interaction is blocked', async () => {
      contacts.canInteract.mockResolvedValue(false);
      await expect(service.openDm('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'BLOCKED' },
      });
    });

    it('throws 403 FORBIDDEN when the pair are not contacts', async () => {
      prisma.relation.findFirst.mockResolvedValue(null); // not friends
      await expect(service.openDm('u1', 'u2')).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
    });

    it('returns the existing DM with created=false (200) without writing', async () => {
      prisma.conversation.findUnique.mockResolvedValue(dmRow()); // findDmByKey hit

      const res = await service.openDm('u1', 'u2');

      expect(res.created).toBe(false);
      expect(res.conversation).toMatchObject({ id: 'c1', type: 'dm', otherUser: { id: 'u2' } });
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('creates the DM (201), persists both UserChats, then emits conversation.created', async () => {
      prisma.conversation.findUnique
        .mockResolvedValueOnce(null) // findDmByKey: none yet
        .mockResolvedValueOnce(dmRow()); // findDmById after create

      const res = await service.openDm('u1', 'u2');

      expect(res.created).toBe(true);
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: { type: 'DM', dmKey: 'u1:u2' },
      });
      expect(prisma.userChat.createMany).toHaveBeenCalledWith({
        data: [
          { userId: 'u1', conversationId: 'c1' },
          { userId: 'u2', conversationId: 'c1' },
        ],
      });
      // persist-then-broadcast: emit happens after the create resolves.
      const createOrder = prisma.userChat.createMany.mock.invocationCallOrder[0];
      const emitOrder = events.emit.mock.invocationCallOrder[0];
      expect(emitOrder).toBeGreaterThan(createOrder);
      expect(events.emit).toHaveBeenCalledWith(AppEvent.ConversationCreated, {
        conversationId: 'c1',
        recipientIds: ['u2'],
      });
    });
  });

  describe('markRead', () => {
    it('throws 404 when the caller is not a participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(
        dmRow({ userChats: [{ userId: 'x', user: userRow('x') }, { userId: 'y', user: userRow('y') }] }),
      );
      await expect(service.markRead('u1', 'c1', 'm1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
      expect(prisma.conversationRead.upsert).not.toHaveBeenCalled();
    });

    it('throws 404 when the message is not in the conversation', async () => {
      prisma.conversation.findUnique.mockResolvedValue(dmRow());
      prisma.message.findFirst.mockResolvedValue(null);
      await expect(service.markRead('u1', 'c1', 'm1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('upserts the read marker then emits message.read after commit', async () => {
      prisma.conversation.findUnique.mockResolvedValue(dmRow());
      prisma.message.findFirst.mockResolvedValue({ id: 'm1' });

      await service.markRead('u1', 'c1', 'm1');

      expect(prisma.conversationRead.upsert).toHaveBeenCalledWith({
        where: { userId_conversationId: { userId: 'u1', conversationId: 'c1' } },
        create: { userId: 'u1', conversationId: 'c1', lastReadMessageId: 'm1', lastReadAt: expect.any(Date) },
        update: { lastReadMessageId: 'm1', lastReadAt: expect.any(Date) },
      });
      const upsertOrder = prisma.conversationRead.upsert.mock.invocationCallOrder[0];
      const emitOrder = events.emit.mock.invocationCallOrder[0];
      expect(emitOrder).toBeGreaterThan(upsertOrder);
      expect(events.emit).toHaveBeenCalledWith(AppEvent.MessageRead, {
        conversationId: 'c1',
        lastReadMessageId: 'm1',
        userId: 'u1',
      });
    });
  });
});
