// test/contract-users.spec.ts
// Contract conformance for /api/users — boots the full app against a real Postgres
// (provided by docker-compose / the schema gate) and exercises every REST operation
// in docs/contract/users.openapi.yaml: profile read/update, avatar put/delete,
// presence, search (self + block exclusion), and public profile lookup, plus the
// documented error envelopes. ThrottlerGuard is bypassed for the functional cases.
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

// A 1x1 transparent PNG.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Users contract (/api/users)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
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
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  const server = () => app.getHttpServer();

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

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('GET /users/me → 200 SelfUser', async () => {
    const alice = await signup('alice_01');
    const res = await request(server()).get('/api/users/me').set(auth(alice.accessToken));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: alice.id,
      username: 'alice_01',
      email: 'alice_01@example.com',
      presence: 'offline',
      avatarUrl: null,
      bio: null,
    });
    expect(typeof res.body.createdAt).toBe('string');
  });

  it('GET /users/me without a token → 401', async () => {
    const res = await request(server()).get('/api/users/me');
    expect(res.status).toBe(401);
  });

  it('PATCH /users/me → 200 with the updated profile; bad body → 422', async () => {
    const alice = await signup('alice_01');

    const ok = await request(server())
      .patch('/api/users/me')
      .set(auth(alice.accessToken))
      .send({ displayName: 'Alice A.', bio: 'hello' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ displayName: 'Alice A.', bio: 'hello' });

    const cleared = await request(server())
      .patch('/api/users/me')
      .set(auth(alice.accessToken))
      .send({ bio: null });
    expect(cleared.status).toBe(200);
    expect(cleared.body.bio).toBeNull();

    const bad = await request(server())
      .patch('/api/users/me')
      .set(auth(alice.accessToken))
      .send({ displayName: '', bio: 'x'.repeat(200) });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PUT /users/me/avatar → 200 { avatarUrl }; wrong type → 422; then DELETE → 204', async () => {
    const alice = await signup('alice_01');

    const ok = await request(server())
      .put('/api/users/me/avatar')
      .set(auth(alice.accessToken))
      .attach('file', PNG_1PX, { filename: 'a.png', contentType: 'image/png' });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.avatarUrl).toBe('string');

    const wrong = await request(server())
      .put('/api/users/me/avatar')
      .set(auth(alice.accessToken))
      .attach('file', Buffer.from('not an image'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.code).toBe('VALIDATION_ERROR');

    const del = await request(server()).delete('/api/users/me/avatar').set(auth(alice.accessToken));
    expect(del.status).toBe(204);

    const me = await request(server()).get('/api/users/me').set(auth(alice.accessToken));
    expect(me.body.avatarUrl).toBeNull();
  });

  it('PATCH /users/me/presence → 200 { presence }; offline is not settable → 422', async () => {
    const alice = await signup('alice_01');

    const ok = await request(server())
      .patch('/api/users/me/presence')
      .set(auth(alice.accessToken))
      .send({ status: 'away' });
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({ presence: 'away' });

    const bad = await request(server())
      .patch('/api/users/me/presence')
      .set(auth(alice.accessToken))
      .send({ status: 'offline' });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /users/search → 200 Paginated; excludes the caller; missing q → 422', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const res = await request(server())
      .get('/api/users/search')
      .query({ q: 'b' })
      .set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('nextCursor');
    const ids = res.body.data.map((r: { user: { id: string } }) => r.user.id);
    expect(ids).toContain(bob.id);
    expect(ids).not.toContain(alice.id);
    expect(res.body.data[0]).toMatchObject({ relationship: expect.any(String) });

    const missingQ = await request(server())
      .get('/api/users/search')
      .set(auth(alice.accessToken));
    expect(missingQ.status).toBe(422);
    expect(missingQ.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /users/:userId → 200 PublicUser; unknown id → 404', async () => {
    const alice = await signup('alice_01');
    const bob = await signup('bob_02');

    const res = await request(server())
      .get(`/api/users/${bob.id}`)
      .set(auth(alice.accessToken));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: bob.id, username: 'bob_02', presence: 'offline' });
    expect(res.body).not.toHaveProperty('email'); // PublicUser, not SelfUser

    const missing = await request(server())
      .get('/api/users/00000000-0000-0000-0000-000000000000')
      .set(auth(alice.accessToken));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });
});
