// test/schema-notifications.spec.ts
// Gate G1 — schema conformance for the entities backing the **notifications** feature
// (docs/qa/qa.md §G1, docs/ERD/prisma-schema-design.md). Boots a real Prisma client and
// asserts both the CRUD round-trip and the constraint that carries business meaning — a
// violating write MUST fail:
//   - Notification.requestId unique  (the relaxed 1:0..1 link to Request, note 5):
//     a Request can back at most one Notification.
import 'dotenv/config';
import { NotificationType, Prisma, RequestType } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';

const TAG = `g1notif_${Date.now()}_`;

async function expectUniqueViolation(op: Promise<unknown>): Promise<void> {
  try {
    await op;
    throw new Error('expected a unique-constraint violation, but the write succeeded');
  } catch (e) {
    expect(e).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect((e as Prisma.PrismaClientKnownRequestError).code).toBe('P2002');
  }
}

describe('Schema G1 — notifications-feature entities', () => {
  const prisma = new PrismaService();
  const createdUserIds: string[] = [];

  const newUser = async (key: string) => {
    const user = await prisma.user.create({
      data: {
        displayName: `${TAG}${key}`,
        account: { create: { username: `${TAG}${key}`, email: `${TAG}${key}@example.com` } },
      },
    });
    createdUserIds.push(user.id);
    return user;
  };

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    // Deleting users cascades their notifications and requests (onDelete: Cascade).
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    await prisma.$disconnect();
  });

  it('Notification round-trip; read defaults to false; payload + actor persist', async () => {
    const recipient = await newUser('recipient');
    const actor = await newUser('actor');

    const notification = await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        actorId: actor.id,
        type: NotificationType.MENTION,
        payload: { conversationId: 'c-1', messageId: 'm-1' },
      },
    });

    expect(notification.read).toBe(false); // schema @default(false)
    expect(notification.requestId).toBeNull(); // non-request-backed

    const loaded = await prisma.notification.findUnique({
      where: { id: notification.id },
      include: { actor: true, recipient: true },
    });
    expect(loaded!.recipient.id).toBe(recipient.id);
    expect(loaded!.actor!.id).toBe(actor.id);
    expect(loaded!.payload).toEqual({ conversationId: 'c-1', messageId: 'm-1' });
  });

  it('allows a system Notification with a null actor (note 5)', async () => {
    const recipient = await newUser('sysrecipient');
    const notification = await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        type: NotificationType.GENERIC,
        payload: { text: 'welcome' },
      },
    });
    expect(notification.actorId).toBeNull();
  });

  it('rejects a second Notification for the same Request (Notification.requestId unique)', async () => {
    const source = await newUser('reqsource');
    const target = await newUser('reqtarget');

    const request = await prisma.request.create({
      data: {
        sourceUserId: source.id,
        targetUserId: target.id,
        type: RequestType.FRIEND_REQUEST,
      },
    });

    // First notification backed by the request — fine.
    await prisma.notification.create({
      data: {
        recipientId: target.id,
        actorId: source.id,
        type: NotificationType.FRIEND_REQUEST,
        requestId: request.id,
      },
    });

    // A second notification pointing at the same request violates the 0..1 unique.
    await expectUniqueViolation(
      prisma.notification.create({
        data: {
          recipientId: target.id,
          actorId: source.id,
          type: NotificationType.FRIEND_REQUEST,
          requestId: request.id,
        },
      }),
    );
  });
});
