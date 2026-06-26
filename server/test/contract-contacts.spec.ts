// test/contract-contacts.spec.ts
// Contract conformance for /api/contacts — boots the full app against a real Postgres
// and exercises every REST operation in docs/contract/contacts.openapi.yaml: friend
// requests (send / list / accept / decline / mutual auto-accept), friend listing and
// removal, and blocking (block / list / unblock + the cross-cutting block guard), plus
// the documented error envelopes. ThrottlerGuard is bypassed for the functional cases.
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

describe('Contacts contract (/api/contacts)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // overrideProvider (not overrideGuard) — overrideGuard cannot neutralize a guard
      // bound globally via APP_GUARD; the app binds ThrottlerGuard with useExisting so this
      // provider override takes effect and rate limiting is bypassed for functional cases.
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // Cascades clear relations/requests via their FK onDelete: Cascade.
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  const server = () => app.getHttpServer();
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const signup = async (username: string): Promise<SignedUpUser> => {
    const res = await request(server())
      .post('/api/auth/signup')
      .send({
        username,
        email: `${username}@example.com`,
        password: 'password123',
        acceptedTerms: true,
      })
      .expect(201);
    return { id: res.body.user.id, username, accessToken: res.body.accessToken };
  };

  const PUBLIC_USER_KEYS = ['id', 'username', 'displayName', 'avatarUrl', 'bio', 'presence'];

  it('GET /contacts without a token → 401', async () => {
    const res = await request(server()).get('/api/contacts');
    expect(res.status).toBe(401);
  });

  it('GET /contacts → 200 empty Paginated for a fresh user', async () => {
    const alice = await signup('alice_01');
    const res = await request(server()).get('/api/contacts').set(auth(alice.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [], nextCursor: null });
  });

  it('POST /contacts/requests → 201 ContactRequest; self → 422; unknown → 404; duplicate → 409', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(created.status).toBe(201);
    expect(Object.keys(created.body)).toEqual(expect.arrayContaining(['id', 'from', 'to', 'createdAt']));
    expect(created.body.from).toMatchObject({ id: alice.id, username: 'alice_01' });
    expect(created.body.to).toMatchObject({ id: bob.id, username: 'bob_02' });
    expect(Object.keys(created.body.from)).toEqual(expect.arrayContaining(PUBLIC_USER_KEYS));

    const selfReq = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: alice.id });
    expect(selfReq.status).toBe(422);
    expect(selfReq.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: NIL_UUID });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe('NOT_FOUND');

    const dup = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('REQUEST_EXISTS');
  });

  it('GET /contacts/requests → splits incoming vs outgoing', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const aliceView = await request(server())
      .get('/api/contacts/requests')
      .set(auth(alice.accessToken));
    expect(aliceView.status).toBe(200);
    expect(aliceView.body.outgoing).toHaveLength(1);
    expect(aliceView.body.incoming).toHaveLength(0);
    expect(aliceView.body.outgoing[0].to).toMatchObject({ id: bob.id });

    const bobView = await request(server())
      .get('/api/contacts/requests')
      .set(auth(bob.accessToken));
    expect(bobView.body.incoming).toHaveLength(1);
    expect(bobView.body.outgoing).toHaveLength(0);
    expect(bobView.body.incoming[0].from).toMatchObject({ id: alice.id });
  });

  it('POST /contacts/requests/:id/accept → 200 { friend }; wrong recipient → 403; makes both friends', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    const requestId = created.body.id;

    // Sender (not the recipient) cannot accept.
    const forbidden = await request(server())
      .post(`/api/contacts/requests/${requestId}/accept`)
      .set(auth(alice.accessToken));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const accepted = await request(server())
      .post(`/api/contacts/requests/${requestId}/accept`)
      .set(auth(bob.accessToken));
    expect(accepted.status).toBe(200);
    expect(accepted.body.friend).toMatchObject({ id: alice.id, username: 'alice_01' });

    // Both now see each other as friends.
    const aliceFriends = await request(server()).get('/api/contacts').set(auth(alice.accessToken));
    expect(aliceFriends.body.data.map((u: { id: string }) => u.id)).toEqual([bob.id]);
    const bobFriends = await request(server()).get('/api/contacts').set(auth(bob.accessToken));
    expect(bobFriends.body.data.map((u: { id: string }) => u.id)).toEqual([alice.id]);

    // Accepting a now-resolved request → 404.
    const gone = await request(server())
      .post(`/api/contacts/requests/${requestId}/accept`)
      .set(auth(bob.accessToken));
    expect(gone.status).toBe(404);
  });

  it('mutual requests auto-accept into a friendship', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    // Bob sends back → server auto-accepts instead of creating a second pending request.
    const back = await request(server())
      .post('/api/contacts/requests')
      .set(auth(bob.accessToken))
      .send({ userId: alice.id });
    expect(back.status).toBe(201);

    const bobFriends = await request(server()).get('/api/contacts').set(auth(bob.accessToken));
    expect(bobFriends.body.data.map((u: { id: string }) => u.id)).toEqual([alice.id]);
    // No request remains pending for either side.
    const pending = await request(server()).get('/api/contacts/requests').set(auth(bob.accessToken));
    expect(pending.body.incoming).toHaveLength(0);
    expect(pending.body.outgoing).toHaveLength(0);
  });

  it('POST /contacts/requests/:id/decline → 204 removes the request', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const declined = await request(server())
      .post(`/api/contacts/requests/${created.body.id}/decline`)
      .set(auth(bob.accessToken));
    expect(declined.status).toBe(204);

    const bobView = await request(server()).get('/api/contacts/requests').set(auth(bob.accessToken));
    expect(bobView.body.incoming).toHaveLength(0);
    // No friendship was created.
    const bobFriends = await request(server()).get('/api/contacts').set(auth(bob.accessToken));
    expect(bobFriends.body.data).toHaveLength(0);
  });

  it('DELETE /contacts/:userId → 204 removes the friendship; non-contact → 404', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    await request(server())
      .post(`/api/contacts/requests/${created.body.id}/accept`)
      .set(auth(bob.accessToken))
      .expect(200);

    const removed = await request(server())
      .delete(`/api/contacts/${bob.id}`)
      .set(auth(alice.accessToken));
    expect(removed.status).toBe(204);

    const aliceFriends = await request(server()).get('/api/contacts').set(auth(alice.accessToken));
    expect(aliceFriends.body.data).toHaveLength(0);

    const again = await request(server())
      .delete(`/api/contacts/${bob.id}`)
      .set(auth(alice.accessToken));
    expect(again.status).toBe(404);
  });

  it('POST /contacts/blocks → 201; list/blocked + enforcement; duplicate → 409; self → 422', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const blocked = await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(blocked.status).toBe(201);
    expect(blocked.body.blockedUser).toMatchObject({ id: bob.id, username: 'bob_02' });
    expect(Object.keys(blocked.body.blockedUser)).toEqual(expect.arrayContaining(PUBLIC_USER_KEYS));

    const list = await request(server()).get('/api/contacts/blocked').set(auth(alice.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([bob.id]);
    expect(list.body).toHaveProperty('nextCursor');

    // Block guard: cannot send a friend request to a blocked user (either direction).
    const guarded = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(guarded.status).toBe(403);
    expect(guarded.body.error.code).toBe('BLOCKED');

    const fromBlocked = await request(server())
      .post('/api/contacts/requests')
      .set(auth(bob.accessToken))
      .send({ userId: alice.id });
    expect(fromBlocked.status).toBe(403);
    expect(fromBlocked.body.error.code).toBe('BLOCKED');

    const dup = await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_BLOCKED');

    const self = await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: alice.id });
    expect(self.status).toBe(422);
  });

  it('blocking an existing friend drops the friendship and pending requests', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const created = await request(server())
      .post('/api/contacts/requests')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);
    await request(server())
      .post(`/api/contacts/requests/${created.body.id}/accept`)
      .set(auth(bob.accessToken))
      .expect(200);

    await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const aliceFriends = await request(server()).get('/api/contacts').set(auth(alice.accessToken));
    expect(aliceFriends.body.data).toHaveLength(0);
    const bobFriends = await request(server()).get('/api/contacts').set(auth(bob.accessToken));
    expect(bobFriends.body.data).toHaveLength(0);
  });

  it('DELETE /contacts/blocks/:userId → 204; not blocked → 404; restores no friendship', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    await request(server())
      .post('/api/contacts/blocks')
      .set(auth(alice.accessToken))
      .send({ userId: bob.id })
      .expect(201);

    const unblocked = await request(server())
      .delete(`/api/contacts/blocks/${bob.id}`)
      .set(auth(alice.accessToken));
    expect(unblocked.status).toBe(204);

    const list = await request(server()).get('/api/contacts/blocked').set(auth(alice.accessToken));
    expect(list.body.data).toHaveLength(0);

    // They are strangers again — interaction is permitted, no friendship restored.
    const friends = await request(server()).get('/api/contacts').set(auth(alice.accessToken));
    expect(friends.body.data).toHaveLength(0);

    const again = await request(server())
      .delete(`/api/contacts/blocks/${bob.id}`)
      .set(auth(alice.accessToken));
    expect(again.status).toBe(404);
  });
});
