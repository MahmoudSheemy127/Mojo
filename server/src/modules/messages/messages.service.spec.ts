import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { decodeTime, ulid } from 'ulid';
import { MessagesService } from './messages.service';
import { ContactsService } from '../contacts/contacts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AppEvent } from '../../events/app-events';

const dmConvo = (over: Record<string, unknown> = {}) => ({
  id: 'c1',
  type: 'DM',
  userChats: [{ userId: 'u1' }, { userId: 'u2' }],
  group: null,
  ...over,
});

const groupConvo = (over: Record<string, unknown> = {}) => ({
  id: 'g1',
  type: 'GROUP',
  userChats: [],
  group: { members: [{ userId: 'u1' }, { userId: 'u2' }] },
  ...over,
});

const PERSISTED_ID = ulid();

const messageRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  conversationId: 'c1',
  senderId: 'u1',
  content: 'hello',
  createdAt: new Date('2026-01-02T00:00:00.000Z'),
  deletedAt: null,
  attachments: [],
  ...over,
});

describe('MessagesService', () => {
  let service: MessagesService;
  let prisma: {
    conversation: { findUnique: jest.Mock; update: jest.Mock };
    message: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    attachment: { updateMany: jest.Mock; deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let contacts: { canInteract: jest.Mock };
  let events: { emit: jest.Mock };

  beforeEach(async () => {
    prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue(dmConvo()),
        update: jest.fn().mockResolvedValue({ id: 'c1' }),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(messageRow(PERSISTED_ID)),
        create: jest.fn().mockResolvedValue(messageRow(PERSISTED_ID)),
        update: jest.fn().mockResolvedValue(messageRow(PERSISTED_ID)),
      },
      attachment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    contacts = { canInteract: jest.fn().mockResolvedValue(true) };
    events = { emit: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsService, useValue: contacts },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();

    service = moduleRef.get(MessagesService);
  });

  describe('list', () => {
    it('throws 404 when the conversation does not exist or the caller is not a participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.list('u1', 'c1', 30, undefined)).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });

      prisma.conversation.findUnique.mockResolvedValue(
        dmConvo({ userChats: [{ userId: 'x' }, { userId: 'y' }] }),
      );
      await expect(service.list('u1', 'c1', 30, undefined)).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('returns the page oldest→newest and a nextCursor when more rows exist', async () => {
      const a = ulid();
      const b = ulid();
      const c = ulid();
      // Stored newest→oldest (id desc). Ask for limit 2 → 3 rows fetched (limit + 1).
      prisma.message.findMany.mockResolvedValue([
        messageRow(c, { id: c }),
        messageRow(b, { id: b }),
        messageRow(a, { id: a }),
      ]);

      const res = await service.list('u1', 'c1', 2, undefined);

      expect(prisma.message.findMany.mock.calls[0][0].take).toBe(3);
      expect(prisma.message.findMany.mock.calls[0][0].orderBy).toEqual({ id: 'desc' });
      // Page is the 2 newest (c, b), reversed to oldest→newest (b, c).
      expect(res.data.map((m) => m.id)).toEqual([b, c]);
      // nextCursor points to the oldest in the page (b) for the next older page.
      expect(res.nextCursor).toBe(
        Buffer.from(JSON.stringify({ id: b }), 'utf8').toString('base64url'),
      );
      expect(res.data[0].sequence).toBe(decodeTime(b));
    });

    it('applies the cursor as id < cursor and returns null nextCursor at history start', async () => {
      const only = ulid();
      prisma.message.findMany.mockResolvedValue([messageRow(only, { id: only })]);
      const cursor = Buffer.from(JSON.stringify({ id: 'zzz' }), 'utf8').toString('base64url');

      const res = await service.list('u1', 'c1', 30, cursor);

      expect(prisma.message.findMany.mock.calls[0][0].where).toEqual({
        conversationId: 'c1',
        id: { lt: 'zzz' },
      });
      expect(res.nextCursor).toBeNull();
    });
  });

  describe('send', () => {
    it('throws 404 when the caller is not a participant', async () => {
      prisma.conversation.findUnique.mockResolvedValue(null);
      await expect(service.send('u1', 'c1', { content: 'hi' })).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('throws 403 BLOCKED for a DM when interaction is blocked', async () => {
      contacts.canInteract.mockResolvedValue(false);
      await expect(service.send('u1', 'c1', { content: 'hi' })).rejects.toMatchObject({
        response: { code: 'BLOCKED' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('does not run the block guard for group conversations', async () => {
      prisma.conversation.findUnique.mockResolvedValue(groupConvo());
      await service.send('u1', 'g1', { content: 'hi' });
      expect(contacts.canInteract).not.toHaveBeenCalled();
    });

    it('persists first, then emits message.created AFTER commit, echoing clientNonce', async () => {
      const res = await service.send('u1', 'c1', { content: 'hello', clientNonce: 'nonce-1' });

      expect(prisma.message.create).toHaveBeenCalledTimes(1);
      const createOrder = prisma.message.create.mock.invocationCallOrder[0];
      const emitOrder = events.emit.mock.invocationCallOrder[0];
      expect(emitOrder).toBeGreaterThan(createOrder); // persist-then-broadcast (NF-16)

      expect(events.emit).toHaveBeenCalledWith(AppEvent.MessageCreated, {
        conversationId: 'c1',
        message: expect.objectContaining({ id: PERSISTED_ID, status: 'sent' }),
      });
      expect(res.clientNonce).toBe('nonce-1');
      expect(res).toMatchObject({ id: PERSISTED_ID, conversationId: 'c1', content: 'hello' });
    });

    it('links the caller’s own unattached uploads to the new message', async () => {
      await service.send('u1', 'c1', { content: null, attachmentIds: ['a1', 'a2'] });
      // The message id is the app-generated ULID passed to create — the same id links uploads.
      const newId = prisma.message.create.mock.calls[0][0].data.id as string;
      expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['a1', 'a2'] }, uploaderId: 'u1', messageId: null },
        data: { messageId: newId },
      });
    });
  });

  describe('softDelete', () => {
    it('throws 404 when the message does not exist', async () => {
      prisma.message.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('u1', 'm1')).rejects.toMatchObject({
        response: { code: 'NOT_FOUND' },
      });
    });

    it('throws 403 FORBIDDEN when the caller is not the sender', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'someone-else',
      });
      await expect(service.softDelete('u1', 'm1')).rejects.toMatchObject({
        response: { code: 'FORBIDDEN' },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('soft-deletes (nulls content, drops attachments) then emits message.deleted', async () => {
      prisma.message.findUnique.mockResolvedValue({
        id: 'm1',
        conversationId: 'c1',
        senderId: 'u1',
      });

      await service.softDelete('u1', 'm1');

      expect(prisma.attachment.deleteMany).toHaveBeenCalledWith({ where: { messageId: 'm1' } });
      expect(prisma.message.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { content: null, deletedAt: expect.any(Date) },
      });
      const updateOrder = prisma.message.update.mock.invocationCallOrder[0];
      const emitOrder = events.emit.mock.invocationCallOrder[0];
      expect(emitOrder).toBeGreaterThan(updateOrder);
      expect(events.emit).toHaveBeenCalledWith(AppEvent.MessageDeleted, {
        conversationId: 'c1',
        messageId: 'm1',
      });
    });
  });
});
