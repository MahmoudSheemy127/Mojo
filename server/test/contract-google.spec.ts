// test/contract-google.spec.ts
// Contract conformance for the Google OAuth endpoints (docs/api/auth.md §Google
// OAuth, FR-02). The start + failure paths run against the REAL GoogleStrategy
// (no network: the consent redirect and an `error=access_denied` callback are
// both handled locally). The success path overrides the strategy with a stub so
// the find-or-create + cookie + redirect handoff can be asserted without Google.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Strategy } from 'passport-google-oauth20';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GoogleStrategy } from '../src/modules/auth/strategies/google.strategy';
import { PrismaService } from '../src/prisma/prisma.service';

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

const bootstrap = async (app: INestApplication) => {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ZodValidationPipe());
  // Exception filters are applied globally by AppModule (APP_FILTER providers).
  app.use(cookieParser());
  await app.init();
};

describe('Google OAuth contract — start & failure (real strategy)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    await bootstrap(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('GET /auth/google → 302 redirect to the Google consent screen', async () => {
    const res = await request(server()).get('/api/auth/google');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  it('GET /auth/google/callback with a denied handshake → 302 to /login?error=oauth_failed', async () => {
    const res = await request(server())
      .get('/api/auth/google/callback')
      .query({ error: 'access_denied' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/login?error=oauth_failed`);
    // No refresh cookie is set on failure.
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

// Stub strategy: forces a successful handshake with a fixed profile, no network.
class StubGoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({ clientID: 'test', clientSecret: 'test', callbackURL: 'http://localhost/cb' });
  }
  // Required by the PassportStrategy mixin; unused because authenticate() short-circuits.
  validate(): unknown {
    return null;
  }
  authenticate(): void {
    (this as unknown as { success: (u: unknown) => void }).success({
      providerUserId: 'g-stub-1',
      email: 'oauth.user@example.com',
      displayName: 'OAuth User',
      avatarUrl: null,
    });
  }
}

describe('Google OAuth contract — successful callback (stubbed strategy)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(GoogleStrategy)
      .useClass(StubGoogleStrategy)
      .compile();
    app = moduleRef.createNestApplication();
    await bootstrap(app);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  it('provisions the user, sets an httpOnly refresh cookie, and redirects with NO token in the URL', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/google/callback');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${WEB_ORIGIN}/auth/callback`);
    // Handoff keeps the access token out of the URL (auth.md recommendation).
    expect(res.headers.location).not.toContain('accessToken');
    expect(res.headers.location).not.toContain('#');

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    const cookie = setCookie.find((c) => c.startsWith('refreshToken='));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');

    // The find-or-create persisted a passwordless account linked to Google.
    const account = await prisma.account.findUnique({
      where: { email: 'oauth.user@example.com' },
      include: { oauthAccounts: true },
    });
    expect(account?.passwordHash).toBeNull();
    expect(account?.oauthAccounts[0]).toMatchObject({
      provider: 'google',
      providerUserId: 'g-stub-1',
    });
  });

  it('is idempotent — a second callback for the same Google identity reuses the account', async () => {
    await request(app.getHttpServer()).get('/api/auth/google/callback').expect(302);
    await request(app.getHttpServer()).get('/api/auth/google/callback').expect(302);

    const accounts = await prisma.account.count({ where: { email: 'oauth.user@example.com' } });
    expect(accounts).toBe(1);
  });
});
