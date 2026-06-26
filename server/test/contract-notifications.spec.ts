// test/contract-notifications.spec.ts
// Contract conformance for /api/notifications — boots the full app against a real Postgres
// and exercises every REST operation in docs/contract/notifications.openapi.yaml: the
// keyset-paginated feed (newest first, caller-scoped), the unseen count that drives the bell
// badge, and the mark-seen call that clears it (all unseen, or a specific id set).
//
// Notifications are created as side effects of OTHER domains (friend requests, mentions,
// invites); here we seed them directly via Prisma, the same way contract-conversations seeds
// messages for the read-marker case. Users are created ONCE and reused; only notification
// rows are reset between tests.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import { NotificationType, Prisma } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface SignedUpUser {
  id: string;
  username: string;
  accessToken: string;
}

describe('Notifications contract (/api/notifications)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: SignedUpUser;
  let bob: SignedUpUser;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signup = async (username: string): Promise<SignedUpUser> => {
    const res = await request(server())
      .post('/api/auth/signup')
      .send({ username, email: `${username}@example.com`, password: 'password123', acceptedTerms: true })
      .expect(201);
    return { id: res.body.user.id, username, accessToken: res.body.accessToken };
  };

  /** Seed a notification row directly (creation lives in other domains). */
  const seedNotification = (over: {
    recipientId: string;
    type?: NotificationType;
    actorId?: string | null;
    read?: boolean;
    payload?: Prisma.InputJsonObject | null;
    createdAt?: Date;
  }) =>
    prisma.notification.create({
      data: {
        recipientId: over.recipientId,
        type: over.type ?? NotificationType.FRIEND_REQUEST,
        actorId: over.actorId === undefined ? null : over.actorId,
        read: over.read ?? false,
        payload: over.payload ?? undefined,
        ...(over.createdAt ? { createdAt: over.createdAt } : {}),
      },
    });

  const NOTIFICATION_KEYS = ['id', 'type', 'actor', 'read', 'createdAt', 'payload'];
  const PUBLIC_USER_KEYS = ['id', 'username', 'displayName', 'avatarUrl', 'bio', 'presence'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();

    alice = await signup('alice_notif');
    bob = await signup('bob_notif');
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany();
  });

  afterAll(async () => {
    await prisma.notification.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('GET /notifications without a token → 401', async () => {
    const res = await request(server()).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('GET /notifications → 200 empty Paginated for a fresh user', async () => {
    const res = await request(server()).get('/api/notifications').set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });

  it('GET /notifications → newest first, caller-scoped, contract-shaped', async () => {
    await seedNotification({
      recipientId: alice.id,
      actorId: bob.id,
      type: NotificationType.FRIEND_REQUEST,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const newer = await seedNotification({
      recipientId: alice.id,
      actorId: null,
      type: NotificationType.GENERIC,
      payload: { text: 'welcome' },
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    // Bob's own notification must not leak into alice's feed.
    await seedNotification({ recipientId: bob.id, actorId: alice.id });

    const res = await request(server()).get('/api/notifications').set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    // Newest first.
    expect(res.body.data[0].id).toBe(newer.id);
    expect(Object.keys(res.body.data[0])).toEqual(expect.arrayContaining(NOTIFICATION_KEYS));

    // Contract enum is lowercase; system notification has a null actor; payload round-trips.
    expect(res.body.data[0].type).toBe('generic');
    expect(res.body.data[0].actor).toBeNull();
    expect(res.body.data[0].payload).toEqual({ text: 'welcome' });

    // Actor-backed notification carries a PublicUser.
    const fromBob = res.body.data[1];
    expect(fromBob.type).toBe('friend_request');
    expect(fromBob.actor).toMatchObject({ id: bob.id, username: 'bob_notif' });
    expect(Object.keys(fromBob.actor)).toEqual(expect.arrayContaining(PUBLIC_USER_KEYS));
  });

  it('GET /notifications → paginates via nextCursor (no overlap, no gaps)', async () => {
    for (let i = 0; i < 3; i++) {
      await seedNotification({
        recipientId: alice.id,
        actorId: bob.id,
        createdAt: new Date(`2026-02-0${i + 1}T00:00:00.000Z`),
      });
    }

    const first = await request(server())
      .get('/api/notifications?limit=2')
      .set(auth(alice.accessToken));
    expect(first.status).toBe(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await request(server())
      .get(`/api/notifications?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set(auth(alice.accessToken));
    expect(second.status).toBe(200);
    expect(second.body.data).toHaveLength(1);
    expect(second.body.nextCursor).toBeNull();

    const ids = [...first.body.data, ...second.body.data].map((n: { id: string }) => n.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('GET /notifications/count → counts only the caller unseen notifications', async () => {
    await seedNotification({ recipientId: alice.id, read: false });
    await seedNotification({ recipientId: alice.id, read: false });
    await seedNotification({ recipientId: alice.id, read: true });
    await seedNotification({ recipientId: bob.id, read: false });

    const res = await request(server())
      .get('/api/notifications/count')
      .set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ count: 2 });
  });

  it('POST /notifications/seen → 204 marks all unseen seen, count drops to 0', async () => {
    await seedNotification({ recipientId: alice.id, read: false });
    await seedNotification({ recipientId: alice.id, read: false });
    // Bob's stays untouched.
    await seedNotification({ recipientId: bob.id, read: false });

    const res = await request(server())
      .post('/api/notifications/seen')
      .set(auth(alice.accessToken))
      .send();
    expect(res.status).toBe(204);

    const after = await request(server())
      .get('/api/notifications/count')
      .set(auth(alice.accessToken));
    expect(after.body).toEqual({ count: 0 });

    // Bob is unaffected.
    const bobCount = await request(server())
      .get('/api/notifications/count')
      .set(auth(bob.accessToken));
    expect(bobCount.body).toEqual({ count: 1 });
  });

  it('POST /notifications/seen → marks only the given ids when provided', async () => {
    const a = await seedNotification({ recipientId: alice.id, read: false });
    await seedNotification({ recipientId: alice.id, read: false });

    const res = await request(server())
      .post('/api/notifications/seen')
      .set(auth(alice.accessToken))
      .send({ ids: [a.id] });
    expect(res.status).toBe(204);

    const after = await request(server())
      .get('/api/notifications/count')
      .set(auth(alice.accessToken));
    expect(after.body).toEqual({ count: 1 });
  });

  it('POST /notifications/seen → 204 on an empty feed (idempotent badge clear)', async () => {
    const res = await request(server())
      .post('/api/notifications/seen')
      .set(auth(alice.accessToken))
      .send();
    expect(res.status).toBe(204);
  });
});
