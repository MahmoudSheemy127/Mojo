// test/contract-conversations.spec.ts
// Contract conformance for /api/conversations — boots the full app against a real Postgres
// and exercises every REST operation in docs/contract/conversations.openapi.yaml: listing
// chat sessions, the idempotent open-or-create DM (200 vs 201, contacts-only, block
// guarded), fetching a single conversation (membership-gated, 404 for non-members), and
// the durable read marker.
//
// Users are created ONCE in beforeAll and reused; only the social/conversation state is
// reset between tests. (Global APP_GUARD guards — including the auth ThrottlerGuard — are
// not bypassable via overrideGuard, so we keep auth requests well under the 10/min limit
// rather than signing up per test.)
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ulid } from 'ulid';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface SignedUpUser {
  id: string;
  username: string;
  accessToken: string;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

describe('Conversations contract (/api/conversations)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: SignedUpUser;
  let bob: SignedUpUser;
  let carol: SignedUpUser;

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signup = async (username: string): Promise<SignedUpUser> => {
    const res = await request(server())
      .post('/api/auth/signup')
      .send({ username, email: `${username}@example.com`, password: 'password123', acceptedTerms: true })
      .expect(201);
    return { id: res.body.user.id, username, accessToken: res.body.accessToken };
  };

  /** Reset all social + conversation state, keeping the (rate-limited) user accounts. */
  const resetState = async () => {
    await prisma.conversation.deleteMany(); // cascades user_chats, conversation_reads, messages
    await prisma.relation.deleteMany();
    await prisma.request.deleteMany();
  };

  /** Make two users contacts via the contacts API (request → accept). */
  const befriend = async (a: SignedUpUser, b: SignedUpUser): Promise<void> => {
    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(a.accessToken))
      .send({ userId: b.id })
      .expect(201);
    await request(server())
      .post(`/api/contacts/requests/${created.body.id}/accept`)
      .set(auth(b.accessToken))
      .expect(200);
  };

  const CONVERSATION_BASE_KEYS = ['id', 'type', 'lastMessage', 'lastActivityAt', 'unreadCount'];
  const PUBLIC_USER_KEYS = ['id', 'username', 'displayName', 'avatarUrl', 'bio', 'presence'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Bypass rate limiting for functional cases (overrideProvider works for the
      // useExisting-bound global ThrottlerGuard; overrideGuard would not).
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

    alice = await signup('alice_conv');
    bob = await signup('bob_conv');
    carol = await signup('carol_conv');
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.user.deleteMany();
    await app.close();
  });

  it('GET /conversations without a token → 401', async () => {
    const res = await request(server()).get('/api/conversations');
    expect(res.status).toBe(401);
  });

  it('GET /conversations → 200 empty Paginated for a fresh user', async () => {
    const res = await request(server()).get('/api/conversations').set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });

  it('POST /conversations/dm → self 422; unknown 404; not-a-contact 403 FORBIDDEN', async () => {
    const self = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: alice.id });
    expect(self.status).toBe(422);
    expect(self.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: NIL_UUID });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');

    // Strangers (not contacts) cannot open a DM.
    const stranger = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(stranger.status).toBe(403);
    expect(stranger.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /conversations/dm → 201 DmConversation on create, 200 idempotent on repeat', async () => {
    await befriend(alice, bob);

    const created = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(created.status).toBe(201);
    expect(Object.keys(created.body)).toEqual(expect.arrayContaining([...CONVERSATION_BASE_KEYS, 'otherUser']));
    expect(created.body.type).toBe('dm');
    expect(created.body.lastMessage).toBeNull();
    expect(created.body.unreadCount).toBe(0);
    expect(created.body.otherUser).toMatchObject({ id: bob.id, username: 'bob_conv' });
    expect(Object.keys(created.body.otherUser)).toEqual(expect.arrayContaining(PUBLIC_USER_KEYS));

    // Idempotent: same pair → 200 with the same conversation id.
    const again = await request(server())
      .post('/api/conversations/dm')
      .set(auth(bob.accessToken))
      .send({ userId: alice.id });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(created.body.id);
    expect(again.body.otherUser).toMatchObject({ id: alice.id });
  });

  it('POST /conversations/dm → 403 BLOCKED when blocked in either direction', async () => {
    await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const blocked = await request(server())
      .post('/api/conversations/dm')
      .set(auth(bob.accessToken))
      .send({ userId: alice.id });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('BLOCKED');
  });

  it('GET /conversations → lists the DM most-recent first', async () => {
    await befriend(alice, bob);
    const dm = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const list = await request(server()).get('/api/conversations').set(auth(alice.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.map((c: { id: string }) => c.id)).toEqual([dm.body.id]);
    expect(list.body).toHaveProperty('nextCursor');
  });

  it('GET /conversations/:id → 200 for a participant; 404 for a non-member and unknown id', async () => {
    await befriend(alice, bob);
    const dm = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const ok = await request(server())
      .get(`/api/conversations/${dm.body.id}`)
      .set(auth(bob.accessToken));
    expect(ok.status).toBe(200);
    // From bob's perspective the other participant is alice.
    expect(ok.body).toMatchObject({ id: dm.body.id, type: 'dm', otherUser: { id: alice.id } });

    // Non-member gets 404 (no existence leak).
    const leak = await request(server())
      .get(`/api/conversations/${dm.body.id}`)
      .set(auth(carol.accessToken));
    expect(leak.status).toBe(404);
    expect(leak.body.error.code).toBe('NOT_FOUND');

    const unknown = await request(server())
      .get(`/api/conversations/${NIL_UUID}`)
      .set(auth(alice.accessToken));
    expect(unknown.status).toBe(404);
  });

  it('POST /conversations/:id/read → 204 advances the marker and clears unreadCount', async () => {
    await befriend(alice, bob);
    const dm = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    const conversationId = dm.body.id as string;

    // Seed a message from bob directly (the messages feature is out of scope here).
    const messageId = ulid();
    await prisma.message.create({
      data: { id: messageId, conversationId, senderId: bob.id, content: 'hello alice' },
    });

    // Alice now has 1 unread.
    const before = await request(server()).get('/api/conversations').set(auth(alice.accessToken));
    expect(before.body.data[0].unreadCount).toBe(1);

    // Unknown conversation / non-member → 404.
    const missing = await request(server())
      .post(`/api/conversations/${NIL_UUID}/read`)
      .set(auth(alice.accessToken))
      .send({ lastReadMessageId: messageId });
    expect(missing.status).toBe(404);

    // Message not in this conversation → 404.
    const wrongMessage = await request(server())
      .post(`/api/conversations/${conversationId}/read`)
      .set(auth(alice.accessToken))
      .send({ lastReadMessageId: ulid() });
    expect(wrongMessage.status).toBe(404);

    const read = await request(server())
      .post(`/api/conversations/${conversationId}/read`)
      .set(auth(alice.accessToken))
      .send({ lastReadMessageId: messageId });
    expect(read.status).toBe(204);

    const after = await request(server()).get('/api/conversations').set(auth(alice.accessToken));
    expect(after.body.data[0].unreadCount).toBe(0);
  });
});
