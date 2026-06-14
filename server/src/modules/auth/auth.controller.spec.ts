// src/modules/auth/auth.controller.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

const CFG: Record<string, unknown> = {
  nodeEnv: 'test',
  'cookie.domain': 'localhost',
  'jwt.refreshTtl': 2592000,
};

const principal: AuthUser = { id: 'u1', username: 'alice', email: 'alice@example.com' };

describe('AuthController', () => {
  let controller: AuthController;
  let auth: {
    signup: jest.Mock;
    login: jest.Mock;
    refresh: jest.Mock;
    logout: jest.Mock;
  };

  const mockRes = () => ({ cookie: jest.fn(), clearCookie: jest.fn() });

  beforeEach(async () => {
    auth = {
      signup: jest.fn().mockResolvedValue({ user: { id: 'u1' }, accessToken: 'a', refreshToken: 'r' }),
      login: jest.fn().mockResolvedValue({ user: { id: 'u1' }, accessToken: 'a', refreshToken: 'r' }),
      refresh: jest.fn().mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' }),
      logout: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: { get: (k: string) => CFG[k] } },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('signup sets an httpOnly refresh cookie and returns only user + accessToken', async () => {
    const res = mockRes();
    const out = await controller.signup(
      { username: 'a', email: 'a@b.com', password: 'password123', acceptedTerms: true },
      res as never,
    );

    expect(out).toEqual({ user: { id: 'u1' }, accessToken: 'a' });
    expect(out).not.toHaveProperty('refreshToken');
    expect(res.cookie).toHaveBeenCalledWith(
      'refreshToken',
      'r',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/api/auth' }),
    );
  });

  it('login sets the refresh cookie', async () => {
    const res = mockRes();
    await controller.login({ identifier: 'a', password: 'x' }, res as never);
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'r', expect.objectContaining({ httpOnly: true }));
  });

  it('refresh rotates using the refresh principal and resets the cookie', async () => {
    const res = mockRes();
    const req = { user: { userId: 'u1', tokenId: 'tok1', rawToken: 'r' } };
    const out = await controller.refresh(req as never, res as never);

    expect(auth.refresh).toHaveBeenCalledWith('u1', 'tok1');
    expect(out).toEqual({ accessToken: 'a2' });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'r2', expect.anything());
  });

  it('logout revokes the current token and clears the cookie', async () => {
    const res = mockRes();
    const req = { cookies: { refreshToken: 'raw' } };
    await controller.logout(principal, req as never, res as never, undefined);

    expect(auth.logout).toHaveBeenCalledWith('u1', 'raw', false);
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({ path: '/api/auth' }));
  });

  it('logout?all=true requests revoke-all', async () => {
    const res = mockRes();
    const req = { cookies: {} };
    await controller.logout(principal, req as never, res as never, 'true');
    expect(auth.logout).toHaveBeenCalledWith('u1', null, true);
  });
});
