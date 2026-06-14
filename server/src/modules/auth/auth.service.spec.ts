// src/modules/auth/auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { hashPassword } from '../../common/utils/hash';

const knownP2002 = (target: string[]) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.8.0',
    meta: { target },
  });

// Prisma 7 + driver adapter (@prisma/adapter-pg) reports the conflicting columns
// here and does NOT populate meta.target — the shape the real DB produces.
const adapterP2002 = (fields: string[]) =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.8.0',
    meta: { modelName: 'User', driverAdapterError: { cause: { constraint: { fields } } } },
  });

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { create: jest.Mock };
    account: { findFirst: jest.Mock; findUnique: jest.Mock };
    token: { findUnique: jest.Mock };
    oAuthAccount: { findUnique: jest.Mock; create: jest.Mock };
  };
  let tokens: {
    issuePair: jest.Mock;
    rotateRefresh: jest.Mock;
    revoke: jest.Mock;
    revokeAllForUser: jest.Mock;
  };

  const userRow = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    displayName: 'alice',
    avatarUrl: null,
    bio: null,
    presence: 'OFFLINE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    account: { username: 'alice', email: 'alice@example.com' },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      user: { create: jest.fn() },
      account: { findFirst: jest.fn(), findUnique: jest.fn() },
      token: { findUnique: jest.fn() },
      oAuthAccount: { findUnique: jest.fn(), create: jest.fn() },
    };
    tokens = {
      issuePair: jest.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
      rotateRefresh: jest.fn().mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokens },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('signup', () => {
    it('hashes the password (argon2id, never plaintext), lowercases email, issues tokens, returns SelfUser', async () => {
      prisma.user.create.mockResolvedValue(userRow());

      const res = await service.signup({
        username: 'alice',
        email: 'Alice@Example.com',
        password: 'password123',
        acceptedTerms: true,
      });

      const arg = prisma.user.create.mock.calls[0][0];
      const passwordHash: string = arg.data.account.create.passwordHash;
      expect(passwordHash).toContain('$argon2id$');
      expect(passwordHash).not.toContain('password123');
      expect(arg.data.account.create.email).toBe('alice@example.com');
      expect(tokens.issuePair).toHaveBeenCalledWith('u1');
      expect(res).toMatchObject({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: {
          id: 'u1',
          username: 'alice',
          email: 'alice@example.com',
          presence: 'offline', // enum lowercased to contract form
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });

    it('maps a username unique violation to 409 USERNAME_TAKEN', async () => {
      prisma.user.create.mockRejectedValue(knownP2002(['username']));
      await expect(
        service.signup({ username: 'alice', email: 'a@b.com', password: 'password123', acceptedTerms: true }),
      ).rejects.toMatchObject({ response: { code: 'USERNAME_TAKEN' } });
      expect(tokens.issuePair).not.toHaveBeenCalled();
    });

    it('maps an email unique violation to 409 EMAIL_TAKEN', async () => {
      prisma.user.create.mockRejectedValue(knownP2002(['email']));
      await expect(
        service.signup({ username: 'alice', email: 'a@b.com', password: 'password123', acceptedTerms: true }),
      ).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });
    });

    it('maps the Prisma 7 driver-adapter P2002 shape to the right code (email vs username)', async () => {
      prisma.user.create.mockRejectedValueOnce(adapterP2002(['email']));
      await expect(
        service.signup({ username: 'alice', email: 'a@b.com', password: 'password123', acceptedTerms: true }),
      ).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });

      prisma.user.create.mockRejectedValueOnce(adapterP2002(['username']));
      await expect(
        service.signup({ username: 'alice', email: 'a@b.com', password: 'password123', acceptedTerms: true }),
      ).rejects.toMatchObject({ response: { code: 'USERNAME_TAKEN' } });
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const passwordHash = await hashPassword('password123');
      prisma.account.findFirst.mockResolvedValue({
        userId: 'u1',
        username: 'alice',
        email: 'alice@example.com',
        passwordHash,
        user: userRow(),
      });

      const res = await service.login({ identifier: 'alice', password: 'password123' });
      expect(tokens.issuePair).toHaveBeenCalledWith('u1');
      expect(res.accessToken).toBe('access');
      expect(res.user.email).toBe('alice@example.com');
    });

    it('rejects an unknown identifier with a uniform 401 INVALID_CREDENTIALS (no enumeration)', async () => {
      prisma.account.findFirst.mockResolvedValue(null);
      await expect(service.login({ identifier: 'ghost', password: 'x' })).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
      expect(tokens.issuePair).not.toHaveBeenCalled();
    });

    it('rejects a wrong password with the same 401 INVALID_CREDENTIALS', async () => {
      const passwordHash = await hashPassword('correct-horse');
      prisma.account.findFirst.mockResolvedValue({
        userId: 'u1',
        username: 'alice',
        email: 'alice@example.com',
        passwordHash,
        user: userRow(),
      });
      await expect(service.login({ identifier: 'alice', password: 'wrong' })).rejects.toMatchObject({
        response: { code: 'INVALID_CREDENTIALS' },
      });
    });
  });

  describe('refresh / logout', () => {
    it('refresh delegates to TokenService.rotateRefresh', async () => {
      const res = await service.refresh('u1', 'tok1');
      expect(tokens.rotateRefresh).toHaveBeenCalledWith('u1', 'tok1');
      expect(res).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    });

    it('logout(all=true) revokes every token for the user', async () => {
      await service.logout('u1', 'raw', true);
      expect(tokens.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(tokens.revoke).not.toHaveBeenCalled();
    });

    it('logout revokes the current refresh token found by hash', async () => {
      prisma.token.findUnique.mockResolvedValue({ id: 'tok1', userId: 'u1' });
      await service.logout('u1', 'raw-token', false);
      expect(tokens.revoke).toHaveBeenCalledWith('tok1');
    });

    it('logout ignores a refresh token belonging to a different user', async () => {
      prisma.token.findUnique.mockResolvedValue({ id: 'tok1', userId: 'someone-else' });
      await service.logout('u1', 'raw-token', false);
      expect(tokens.revoke).not.toHaveBeenCalled();
    });
  });

  describe('oauthLogin (Google, FR-02)', () => {
    const googleProfile = (over: Record<string, unknown> = {}) => ({
      providerUserId: 'g-123',
      email: 'alice@example.com',
      displayName: 'Alice G',
      avatarUrl: 'https://pic/a.png',
      ...over,
    });

    beforeEach(() => {
      // Defaults: no existing link, no existing account, username free.
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      prisma.oAuthAccount.create.mockResolvedValue({});
      prisma.account.findUnique.mockResolvedValue(null);
    });

    it('returns tokens for an already-linked Google identity (no account created)', async () => {
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        account: { userId: 'u1', username: 'alice', email: 'alice@example.com', user: userRow() },
      });

      const res = await service.oauthLogin(googleProfile());

      expect(tokens.issuePair).toHaveBeenCalledWith('u1');
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
      expect(res.accessToken).toBe('access');
      expect(res.user.email).toBe('alice@example.com');
    });

    it('links Google to an existing same-email account instead of creating a user', async () => {
      prisma.account.findUnique.mockResolvedValue({
        id: 'acc1',
        userId: 'u1',
        username: 'alice',
        email: 'alice@example.com',
        user: userRow(),
      });

      const res = await service.oauthLogin(googleProfile());

      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: { accountId: 'acc1', provider: 'google', providerUserId: 'g-123' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(tokens.issuePair).toHaveBeenCalledWith('u1');
      expect(res.accessToken).toBe('access');
    });

    it('provisions a passwordless User + Account + OAuthAccount for a new Google user', async () => {
      prisma.user.create.mockResolvedValue(userRow());

      const res = await service.oauthLogin(googleProfile());

      const arg = prisma.user.create.mock.calls[0][0];
      expect(arg.data.account.create.passwordHash).toBeNull();
      expect(arg.data.account.create.email).toBe('alice@example.com');
      expect(arg.data.account.create.username).toBe('alice');
      expect(arg.data.account.create.oauthAccounts.create).toEqual({
        provider: 'google',
        providerUserId: 'g-123',
      });
      expect(tokens.issuePair).toHaveBeenCalledWith('u1');
      expect(res.user.presence).toBe('offline');
    });

    it('suffixes the derived username on collision (alice → alice_2)', async () => {
      // 'alice' taken, 'alice_2' free.
      prisma.account.findUnique.mockImplementation(({ where }: { where: { username?: string } }) =>
        Promise.resolve(where.username === 'alice' ? { id: 'other' } : null),
      );
      prisma.user.create.mockResolvedValue(userRow());

      await service.oauthLogin(googleProfile());

      const arg = prisma.user.create.mock.calls[0][0];
      expect(arg.data.account.create.username).toBe('alice_2');
    });

    it('re-resolves once when a concurrent login wins the race (P2002)', async () => {
      prisma.oAuthAccount.findUnique
        .mockResolvedValueOnce(null) // first pass: not linked yet
        .mockResolvedValueOnce({
          account: { userId: 'u1', username: 'alice', email: 'alice@example.com', user: userRow() },
        }); // retry: the winner's link now exists
      prisma.user.create.mockRejectedValue(knownP2002(['provider', 'providerUserId']));

      const res = await service.oauthLogin(googleProfile());

      expect(tokens.issuePair).toHaveBeenCalledWith('u1');
      expect(res.accessToken).toBe('access');
    });
  });
});
