// src/common/filters/prisma-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';

/**
 * Translates known Prisma error codes into the contract envelope. Service code
 * that needs a *specific* code (e.g. USERNAME_TAKEN vs EMAIL_TAKEN on signup)
 * should catch P2002 itself and throw a typed HttpException; this is the fallback.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002': // unique constraint violation
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'Resource already exists';
        break;
      case 'P2025': // record not found
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Resource not found';
        break;
    }

    res.status(status).json({ error: { code, message } });
  }
}
