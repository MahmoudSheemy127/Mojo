// src/common/common.spec.ts
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, lastValueFrom } from 'rxjs';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CorrelationIdInterceptor } from './interceptors/correlation-id.interceptor';

const ctxFor = (req: unknown, res: unknown): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('JwtAuthGuard', () => {
  it('bypasses authentication for @Public() routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    expect(guard.canActivate(ctxFor({}, {}))).toBe(true);
  });

  it('delegates to passport for non-public routes', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    // super.canActivate runs the 'jwt' strategy; here it returns a truthy value
    // (boolean | Promise | Observable). We only assert it does not short-circuit to true.
    const spy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue('delegated');
    expect(guard.canActivate(ctxFor({ headers: {} }, {}))).toBe('delegated');
    spy.mockRestore();
  });
});

describe('CorrelationIdInterceptor', () => {
  const next: CallHandler = { handle: () => of('ok') };

  // The id is minted + echoed on the response by pino's genReqId (app.module.ts);
  // the interceptor only re-exposes pino's req.id as req.correlationId.
  it('surfaces pino req.id as req.correlationId', async () => {
    const req: { id?: string; correlationId?: string } = { id: 'abc-123' };
    const interceptor = new CorrelationIdInterceptor();

    const result = await lastValueFrom(interceptor.intercept(ctxFor(req, {}), next));
    expect(result).toBe('ok');
    expect(req.correlationId).toBe('abc-123');
  });
});
