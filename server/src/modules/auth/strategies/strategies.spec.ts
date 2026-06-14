// src/modules/auth/strategies/strategies.spec.ts
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtStrategy } from './jwt.strategy';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { PrismaService } from '../../../prisma/prisma.service';
import { hashToken } from '../../../common/utils/hash';

const config = (secret: string): ConfigService =>
  ({ get: () => secret }) as unknown as ConfigService;

describe('JwtStrategy.validate', () => {
  it('returns the principal when the account exists', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ username: 'alice', email: 'alice@example.com' }) },
    } as unknown as PrismaService;
    const strategy = new JwtStrategy(config('access-secret-32-chars-aaaaaaaaaa'), prisma);

    await expect(strategy.validate({ sub: 'u1' })).resolves.toEqual({
      id: 'u1',
      username: 'alice',
      email: 'alice@example.com',
    });
  });

  it('throws 401 when the account no longer exists', async () => {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const strategy = new JwtStrategy(config('access-secret-32-chars-aaaaaaaaaa'), prisma);

    await expect(strategy.validate({ sub: 'u1' })).rejects.toMatchObject({
      response: { code: 'UNAUTHENTICATED' },
    });
  });
});

describe('JwtRefreshStrategy.validate', () => {
  const reqWithCookie = (raw: string) =>
    ({ cookies: { refreshToken: raw } }) as unknown as Request;

  const liveToken = (over: Record<string, unknown> = {}) => ({
    id: 'tok1',
    userId: 'u1',
    type: 'REFRESH',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    ...over,
  });

  it('returns the principal for a live, matching token', async () => {
    const prisma = {
      token: { findUnique: jest.fn().mockResolvedValue(liveToken()) },
    } as unknown as PrismaService;
    const strategy = new JwtRefreshStrategy(config('refresh-secret-32-chars-bbbbbbbbb'), prisma);

    const result = await strategy.validate(reqWithCookie('raw'), { sub: 'u1', jti: 'tok1' });
    expect(result).toEqual({ userId: 'u1', tokenId: 'tok1', rawToken: 'raw' });
    expect((prisma.token.findUnique as jest.Mock)).toHaveBeenCalledWith({
      where: { tokenHash: hashToken('raw') },
    });
  });

  it.each([
    ['revoked', liveToken({ revokedAt: new Date() })],
    ['expired', liveToken({ expiresAt: new Date(Date.now() - 1000) })],
    ['wrong user', liveToken({ userId: 'someone-else' })],
    ['missing', null],
  ])('throws REFRESH_INVALID when the token is %s', async (_label, token) => {
    const prisma = {
      token: { findUnique: jest.fn().mockResolvedValue(token) },
    } as unknown as PrismaService;
    const strategy = new JwtRefreshStrategy(config('refresh-secret-32-chars-bbbbbbbbb'), prisma);

    await expect(strategy.validate(reqWithCookie('raw'), { sub: 'u1', jti: 'tok1' })).rejects.toMatchObject({
      response: { code: 'REFRESH_INVALID' },
    });
  });

  it('throws REFRESH_INVALID when the cookie is absent', async () => {
    const prisma = { token: { findUnique: jest.fn() } } as unknown as PrismaService;
    const strategy = new JwtRefreshStrategy(config('refresh-secret-32-chars-bbbbbbbbb'), prisma);

    await expect(
      strategy.validate({ cookies: {} } as unknown as Request, { sub: 'u1', jti: 'tok1' }),
    ).rejects.toMatchObject({ response: { code: 'REFRESH_INVALID' } });
  });
});
