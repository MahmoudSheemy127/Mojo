// src/common/filters/filters.spec.ts
import {
  ArgumentsHost,
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';
import type { PinoLogger } from 'nestjs-pino';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { PrismaExceptionFilter } from './prisma-exception.filter';

const mockResponse = () => {
  const res = {} as { status: jest.Mock; json: jest.Mock };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const hostFor = (res: unknown): ArgumentsHost =>
  ({
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ id: 'test-req-id' }) }),
  }) as unknown as ArgumentsHost;

const mockLogger = () => ({ error: jest.fn(), warn: jest.fn() }) as unknown as PinoLogger;

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter(mockLogger());

  it('maps an HttpException with a { code, message } body to the contract envelope', () => {
    const res = mockResponse();
    filter.catch(new ConflictException({ code: 'USERNAME_TAKEN', message: 'taken' }), hostFor(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'USERNAME_TAKEN', message: 'taken' } });
  });

  it('derives a code from the status when none is provided', () => {
    const res = mockResponse();
    filter.catch(new NotFoundException('nope'), hostFor(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: 'nope' } });
  });

  it('maps an unknown error to 500 INTERNAL', () => {
    const res = mockResponse();
    filter.catch(new Error('boom'), hostFor(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'INTERNAL', message: 'boom' } });
  });

  it('handles an HttpException whose response is a plain string', () => {
    const res = mockResponse();
    filter.catch(new HttpException('plain message', HttpStatus.BAD_REQUEST), hostFor(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'BAD_REQUEST', message: 'plain message' } });
  });

  it('maps a ZodValidationException to 422 VALIDATION_ERROR with issue details', () => {
    const res = mockResponse();
    const parsed = z.object({ a: z.string() }).safeParse({});
    filter.catch(new ZodValidationException(parsed.error!), hostFor(res));

    expect(res.status).toHaveBeenCalledWith(HttpStatus.UNPROCESSABLE_ENTITY);
    const payload = res.json.mock.calls[0][0];
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.details).toBeDefined();
  });
});

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();
  const knownError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('db', { code, clientVersion: '7.8.0' });

  it('maps P2002 to 409 CONFLICT', () => {
    const res = mockResponse();
    filter.catch(knownError('P2002'), hostFor(res));
    expect(res.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'CONFLICT', message: expect.any(String) } });
  });

  it('maps P2025 to 404 NOT_FOUND', () => {
    const res = mockResponse();
    filter.catch(knownError('P2025'), hostFor(res));
    expect(res.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(res.json).toHaveBeenCalledWith({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('falls back to 500 INTERNAL for other codes', () => {
    const res = mockResponse();
    filter.catch(knownError('P2003'), hostFor(res));
    expect(res.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
  });
});
