// test/contract-auth.spec.ts
// Contract conformance for /api/auth — boots the full app against a real
// Postgres (provided by docker-compose / the schema gate) and exercises the
// signup → login → refresh → logout flow plus the documented error envelopes
// (docs/api/auth.md). The ThrottlerGuard is bypassed for the functional cases
// and asserted separately at the end.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const VALID_USER = {
  username: 'alice_01',
  email: 'alice@example.com',
  password: 'password123',
  acceptedTerms: true as const,
};

const refreshCookie = (res: request.Response): string => {
  const setCookie = res.headers['set-cookie'] as unknown as string[];
  const raw = setCookie.find((c) => c.startsWith('refreshToken='));
  if (!raw) throw new Error('no refresh cookie set');
  return raw.split(';')[0]; // name=value only, drop attributes
};

describe('Auth contract (/api/auth)', () => {
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
    // Exception filters are applied globally by AppModule (APP_FILTER providers).
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
  const signup = (body: object) => request(server()).post('/api/auth/signup').send(body);

  it('POST /auth/signup → 201 with { user, accessToken } and an httpOnly refresh cookie', async () => {
    const res = await signup(VALID_USER);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      username: 'alice_01',
      email: 'alice@example.com',
      presence: 'offline',
    });
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body).not.toHaveProperty('refreshToken');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie.find((c) => c.startsWith('refreshToken='));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
  });

  it('duplicate username → 409 USERNAME_TAKEN; duplicate email → 409 EMAIL_TAKEN', async () => {
    await signup(VALID_USER).expect(201);

    const dupUsername = await signup({ ...VALID_USER, email: 'other@example.com' });
    expect(dupUsername.status).toBe(409);
    expect(dupUsername.body.error.code).toBe('USERNAME_TAKEN');

    const dupEmail = await signup({ ...VALID_USER, username: 'bob_02' });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('malformed body → 422 VALIDATION_ERROR with the contract envelope', async () => {
    const res = await signup({ username: 'x', email: 'not-an-email', password: '123', acceptedTerms: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(typeof res.body.error.message).toBe('string');
  });

  it('POST /auth/login → 200; wrong password → 401 INVALID_CREDENTIALS (no enumeration)', async () => {
    await signup(VALID_USER).expect(201);

    const ok = await request(server())
      .post('/api/auth/login')
      .send({ identifier: 'alice_01', password: 'password123' });
    expect(ok.status).toBe(200);
    expect(typeof ok.body.accessToken).toBe('string');

    const bad = await request(server())
      .post('/api/auth/login')
      .send({ identifier: 'alice_01', password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('INVALID_CREDENTIALS');

    const ghost = await request(server())
      .post('/api/auth/login')
      .send({ identifier: 'nobody', password: 'whatever' });
    expect(ghost.status).toBe(401);
    expect(ghost.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /auth/refresh rotates the cookie; replaying the old cookie → 401 REFRESH_INVALID', async () => {
    const s = await signup(VALID_USER).expect(201);
    const oldCookie = refreshCookie(s);

    const r1 = await request(server()).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(r1.status).toBe(200);
    expect(typeof r1.body.accessToken).toBe('string');

    const replay = await request(server()).post('/api/auth/refresh').set('Cookie', oldCookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('REFRESH_INVALID');
  });

  it('POST /auth/logout → 204, then refresh with the cleared cookie → 401', async () => {
    const s = await signup(VALID_USER).expect(201);
    const cookie = refreshCookie(s);
    const accessToken = s.body.accessToken as string;

    const logout = await request(server())
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(logout.status).toBe(204);

    const afterLogout = await request(server()).post('/api/auth/refresh').set('Cookie', cookie);
    expect(afterLogout.status).toBe(401);
  });

  it('an authenticated route rejects a missing/invalid bearer token with 401', async () => {
    const noToken = await request(server()).post('/api/auth/logout');
    expect(noToken.status).toBe(401);

    const garbage = await request(server())
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(garbage.status).toBe(401);
  });
});

describe('Auth rate limiting (NF-11)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    // No guard override here — exercise the real ThrottlerGuard (≤10 req/min/IP).
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ZodValidationPipe());
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  it('returns 429 RATE_LIMITED after exceeding 10 requests/min from one IP', async () => {
    const server = app.getHttpServer();
    let limited = false;
    for (let i = 0; i < 12; i++) {
      const res = await request(server)
        .post('/api/auth/login')
        .send({ identifier: `user_${i}`, password: 'whatever' });
      if (res.status === 429) {
        expect(res.body.error.code).toBe('RATE_LIMITED');
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
