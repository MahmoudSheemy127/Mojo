// src/modules/notifications/mentions.listener.spec.ts
import { Test } from '@nestjs/testing';
import { MentionsListener } from './mentions.listener';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageCreatedPayload } from '../../events/app-events';
import { MessageView } from '../../common/types/conversation-view';

const messageView = (over: Partial<MessageView> = {}): MessageView => ({
  id: 'msg-1',
  conversationId: 'conv-1',
  sequence: 1,
  senderId: 'u1',
  content: 'hey @bob',
  attachments: [],
  status: 'sent',
  createdAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
  ...over,
});

const payloadOf = (message: MessageView): MessageCreatedPayload => ({
  conversationId: message.conversationId,
  message,
});

describe('MentionsListener', () => {
  let listener: MentionsListener;
  let notifications: { create: jest.Mock };
  let prisma: {
    conversation: { findUnique: jest.Mock };
    account: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    notifications = { create: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      conversation: { findUnique: jest.fn() },
      account: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MentionsListener,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    listener = moduleRef.get(MentionsListener);
  });

  it('does nothing when the content has no @mentions', async () => {
    await listener.handle(payloadOf(messageView({ content: 'just a plain message' })));
    expect(prisma.conversation.findUnique).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('does nothing when the content is null (deleted)', async () => {
    await listener.handle(payloadOf(messageView({ content: null })));
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('notifies only mentioned users who are participants, never the sender', async () => {
    // Group conversation with members u1 (sender), u2 (alice), u3 (bob).
    prisma.conversation.findUnique.mockResolvedValue({
      type: 'GROUP',
      userChats: [],
      group: { members: [{ userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' }] },
    });
    // @alice and @bob are participants; @ghost is not resolved.
    prisma.account.findMany.mockResolvedValue([{ userId: 'u2' }, { userId: 'u3' }]);

    await listener.handle(
      payloadOf(messageView({ content: 'cc @alice @bob @ghost @self', senderId: 'u1' })),
    );

    expect(prisma.account.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ['u2', 'u3'] }, // candidates = participants minus sender
        username: { in: ['alice', 'bob', 'ghost', 'self'], mode: 'insensitive' },
      },
      select: { userId: true },
    });
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledWith({
      recipientId: 'u2',
      type: 'MENTION',
      actorId: 'u1',
      payload: { conversationId: 'conv-1', messageId: 'msg-1' },
    });
    expect(notifications.create).toHaveBeenCalledWith({
      recipientId: 'u3',
      type: 'MENTION',
      actorId: 'u1',
      payload: { conversationId: 'conv-1', messageId: 'msg-1' },
    });
  });

  it('swallows errors so a failure never breaks message delivery', async () => {
    prisma.conversation.findUnique.mockRejectedValue(new Error('db down'));
    await expect(
      listener.handle(payloadOf(messageView({ content: '@bob' }))),
    ).resolves.toBeUndefined();
    expect(notifications.create).not.toHaveBeenCalled();
  });
});
