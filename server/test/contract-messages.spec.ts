// test/contract-messages.spec.ts
// Contract conformance for the Messages domain — boots the full app against a real Postgres
// and exercises every REST operation in docs/contract/messages.openapi.yaml: fetching history
// (membership-gated, keyset, oldest→newest), sending (persist-before-ack 201 with the contract
// Message shape + echoed clientNonce, 422 empty, 403 BLOCKED in a DM), soft-delete (sender-only,
// content nulled + deletedAt set, placeholder still listed), and the P3 attachment upload.
//
// Users are created ONCE in beforeAll and reused; only social/conversation state is reset
// between tests. The global ThrottlerGuard is neutralized via overrideProvider so repeated
// auth/signup calls don't trip the 10/min limit.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface SignedUpUser {
  id: string;
  username: string;
  accessToken: string;
}

const NIL_UUID = '00000000-0000-0000-0000-000000000000';
const MESSAGE_KEYS = [
  'id',
  'conversationId',
  'sequence',
  'senderId',
  'content',
  'attachments',
  'status',
  'createdAt',
  'deletedAt',
];

describe('Messages contract (/api/conversations/:id/messages, /api/messages, /api/attachments)', () => {
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

  /** Befriend alice+bob and open their DM; returns the conversation id. */
  const openDm = async (): Promise<string> => {
    await befriend(alice, bob);
    const dm = await request(server())
      .post('/api/conversations/dm')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    return dm.body.id as string;
  };

  const resetState = async () => {
    await prisma.conversation.deleteMany(); // cascades user_chats, conversation_reads, messages, attachments
    await prisma.attachment.deleteMany(); // any unattached uploads
    await prisma.relation.deleteMany();
    await prisma.request.deleteMany();
  };

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

    alice = await signup('alice_msg');
    bob = await signup('bob_msg');
    carol = await signup('carol_msg');
  });

  beforeEach(async () => {
    await resetState();
  });

  afterAll(async () => {
    await resetState();
    await prisma.user.deleteMany();
    await app.close();
  });

  // ── history ──────────────────────────────────────────────────────

  it('GET history without a token → 401', async () => {
    const res = await request(server()).get(`/api/conversations/${NIL_UUID}/messages`);
    expect(res.status).toBe(401);
  });

  it('GET history → 404 for a non-member and an unknown conversation (no existence leak)', async () => {
    const conversationId = await openDm();

    const nonMember = await request(server())
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(carol.accessToken));
    expect(nonMember.status).toBe(404);
    expect(nonMember.body.error.code).toBe('NOT_FOUND');

    const unknown = await request(server())
      .get(`/api/conversations/${NIL_UUID}/messages`)
      .set(auth(alice.accessToken));
    expect(unknown.status).toBe(404);
  });

  it('GET history → 200 empty Paginated for a fresh conversation', async () => {
    const conversationId = await openDm();
    const res = await request(server())
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });

  it('GET history → oldest→newest within a page, keyset paginates backward', async () => {
    const conversationId = await openDm();
    // Send 3 messages in order.
    for (const text of ['first', 'second', 'third']) {
      await request(server())
        .post(`/api/conversations/${conversationId}/messages`)
        .set(auth(alice.accessToken))
        .send({ content: text })
        .expect(201);
    }

    // Newest page (limit 2) → the 2 most recent, ordered oldest→newest = [second, third].
    const page1 = await request(server())
      .get(`/api/conversations/${conversationId}/messages?limit=2`)
      .set(auth(bob.accessToken))
      .expect(200);
    expect(page1.body.data.map((m: { content: string }) => m.content)).toEqual(['second', 'third']);
    expect(page1.body.nextCursor).not.toBeNull();
    expect(Object.keys(page1.body.data[0])).toEqual(expect.arrayContaining(MESSAGE_KEYS));

    // Next older page → [first]; then history start → null cursor.
    const page2 = await request(server())
      .get(`/api/conversations/${conversationId}/messages?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .set(auth(bob.accessToken))
      .expect(200);
    expect(page2.body.data.map((m: { content: string }) => m.content)).toEqual(['first']);
    expect(page2.body.nextCursor).toBeNull();
  });

  // ── send ─────────────────────────────────────────────────────────

  it('POST send → 201 with the contract Message shape and echoed clientNonce', async () => {
    const conversationId = await openDm();
    const res = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: 'hello bob', clientNonce: 'nonce-42' });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(expect.arrayContaining(MESSAGE_KEYS));
    expect(res.body).toMatchObject({
      conversationId,
      senderId: alice.id,
      content: 'hello bob',
      status: 'sent',
      attachments: [],
      deletedAt: null,
      clientNonce: 'nonce-42',
    });
    expect(typeof res.body.sequence).toBe('number');
  });

  it('POST send → 422 VALIDATION_ERROR for an empty message (no content, no attachments)', async () => {
    const conversationId = await openDm();
    const empty = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: '   ' });
    expect(empty.status).toBe(422);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    const none = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({});
    expect(none.status).toBe(422);
  });

  it('POST send → 404 for a non-member, 403 BLOCKED when the DM pair is blocked', async () => {
    const conversationId = await openDm();

    const nonMember = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(carol.accessToken))
      .send({ content: 'intruder' });
    expect(nonMember.status).toBe(404);

    // bob blocks alice; the DM row remains but sending is refused both ways.
    await request(server())
      .post('/api/contacts/blocks')
      .set(auth(bob.accessToken))
      .send({ userId: alice.id })
      .expect(201);

    const blocked = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: 'still there?' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('BLOCKED');
  });

  // ── soft-delete ───────────────────────────────────────────────────

  it('DELETE message → 403 for a non-sender, 404 for unknown, 204 + placeholder for the sender', async () => {
    const conversationId = await openDm();
    const sent = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: 'to be deleted' })
      .expect(201);
    const messageId = sent.body.id as string;

    // Not the sender → 403.
    const notSender = await request(server())
      .delete(`/api/messages/${messageId}`)
      .set(auth(bob.accessToken));
    expect(notSender.status).toBe(403);
    expect(notSender.body.error.code).toBe('FORBIDDEN');

    // Unknown message → 404.
    const unknown = await request(server())
      .delete(`/api/messages/${NIL_UUID}`)
      .set(auth(alice.accessToken));
    expect(unknown.status).toBe(404);

    // Sender → 204.
    const ok = await request(server())
      .delete(`/api/messages/${messageId}`)
      .set(auth(alice.accessToken));
    expect(ok.status).toBe(204);

    // The row remains in history as a placeholder: content null, deletedAt set.
    const history = await request(server())
      .get(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .expect(200);
    const deleted = history.body.data.find((m: { id: string }) => m.id === messageId);
    expect(deleted).toBeDefined();
    expect(deleted.content).toBeNull();
    expect(deleted.deletedAt).not.toBeNull();
  });

  // ── attachments (P3) ──────────────────────────────────────────────

  it('POST /attachments → 401 without a token; 201 Attachment then referenced on send', async () => {
    const unauth = await request(server())
      .post('/api/attachments')
      .attach('file', Buffer.from('hello'), 'note.txt');
    expect(unauth.status).toBe(401);

    const uploaded = await request(server())
      .post('/api/attachments')
      .set(auth(alice.accessToken))
      .attach('file', Buffer.from('binary-image-bytes'), { filename: 'pic.png', contentType: 'image/png' });
    expect(uploaded.status).toBe(201);
    expect(Object.keys(uploaded.body)).toEqual(
      expect.arrayContaining(['id', 'url', 'fileName', 'mimeType', 'sizeBytes', 'kind']),
    );
    expect(uploaded.body.kind).toBe('image');

    // The attachment id can be referenced on send (content may be null when attachments present).
    const conversationId = await openDm();
    const sent = await request(server())
      .post(`/api/conversations/${conversationId}/messages`)
      .set(auth(alice.accessToken))
      .send({ content: null, attachmentIds: [uploaded.body.id] });
    expect(sent.status).toBe(201);
    expect(sent.body.attachments).toHaveLength(1);
    expect(sent.body.attachments[0].id).toBe(uploaded.body.id);
  });
});
