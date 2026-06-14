// src/modules/auth/token.service.spec.ts
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../../common/utils/hash';

const CFG: Record<string, unknown> = {
  'jwt.accessSecret': 'access-secret-access-secret-32xx',
  'jwt.accessTtl': 900,
  'jwt.refreshSecret': 'refresh-secret-refresh-secret-32',
  'jwt.refreshTtl': 2592000,
};

describe('TokenService', () => {
  let service: TokenService;
  let prisma: { token: { create: jest.Mock; update: jest.Mock; updateMany: jest.Mock } };
  let jwt: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      token: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({}),
      },
    };
    // Distinguish access vs refresh by the presence of a jti in the payload.
    jwt = {
      signAsync: jest
        .fn()
        .mockImplementation((payload: { jti?: string }) =>
          Promise.resolve(payload.jti ? 'refresh.jwt' : 'access.jwt'),
        ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (k: string) => CFG[k] } },
      ],
    }).compile();

    service = moduleRef.get(TokenService);
  });

  it('issuePair persists the refresh token as a hash, never raw', async () => {
    const pair = await service.issuePair('u1');
    expect(pair).toEqual({ accessToken: 'access.jwt', refreshToken: 'refresh.jwt' });

    const data = prisma.token.create.mock.calls[0][0].data;
    expect(data.type).toBe('REFRESH');
    expect(data.userId).toBe('u1');
    expect(data.tokenHash).toBe(hashToken('refresh.jwt'));
    expect(data.tokenHash).not.toBe('refresh.jwt');
    expect(data.expiresAt).toBeInstanceOf(Date);
  });

  it('rotateRefresh issues a new pair and revokes + chains the old token', async () => {
    await service.rotateRefresh('u1', 'old-id');

    expect(prisma.token.create).toHaveBeenCalledTimes(1);
    const newId = prisma.token.create.mock.calls[0][0].data.id;
    const upd = prisma.token.update.mock.calls[0][0];
    expect(upd.where).toEqual({ id: 'old-id' });
    expect(upd.data.revokedAt).toBeInstanceOf(Date);
    expect(upd.data.replacedById).toBe(newId);
  });

  it('revoke only touches a live token', async () => {
    await service.revoke('tok1');
    expect(prisma.token.updateMany).toHaveBeenCalledWith({
      where: { id: 'tok1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeAllForUser revokes all live refresh tokens for the user', async () => {
    await service.revokeAllForUser('u1');
    expect(prisma.token.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', type: 'REFRESH', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});

describe('TokenService — access token TTL (NF-10)', () => {
  it('signs an access token that expires in ≤ 15 minutes', async () => {
    const jwt = new JwtService({});
    const prisma = { token: { create: jest.fn().mockResolvedValue({}) } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (k: string) => CFG[k] } },
      ],
    }).compile();
    const service = moduleRef.get(TokenService);

    const { accessToken } = await service.issuePair('u1');
    const decoded = jwt.decode(accessToken) as { iat: number; exp: number };
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(15 * 60);
  });
});
