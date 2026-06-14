// src/common/filters/all-exceptions.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/nestjs';

/**
 * Maps every uncaught error to the contract envelope:
 *   { error: { code, message, details? } }
 * (see docs/api/README.md §Error envelope). Domain code throws HttpExceptions
 * with a `{ code, message }` body to set a stable machine code; anything else
 * falls back to a status-derived code.
 *
 * Observability (docs/observability.md §6): unexpected 5xx are logged at `error`
 * AND captured in Sentry, tagged with the request's correlation id. Expected 4xx
 * (validation, auth, not-found) are logged at `warn` and never sent to Sentry —
 * Sentry sees only what you'd want to be paged about.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(AllExceptionsFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL';
    let message = 'Internal server error';
    let details: unknown;

    if (exception instanceof ZodValidationException) {
      status = HttpStatus.UNPROCESSABLE_ENTITY;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = (exception.getZodError() as { issues?: unknown }).issues;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        code = defaultCodeForStatus(status);
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const r = resp as Record<string, unknown>;
        code = typeof r.code === 'string' ? r.code : defaultCodeForStatus(status);
        message = typeof r.message === 'string' ? r.message : exception.message;
        details = r.details;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const reqId = req.id;

    // Never log request/message bodies (NF-15) — only the error itself.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Unexpected: log at error AND capture in Sentry.
      this.logger.error({ err: exception, reqId, code }, message);
      Sentry.captureException(exception, (scope) => {
        scope.setTag('request_id', reqId ?? 'unknown');
        scope.setTag('error_code', code);
        return scope;
      });
    } else {
      // Expected client error: log at warn, do NOT send to Sentry.
      this.logger.warn({ reqId, status, code }, message);
    }

    res
      .status(status)
      .json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
  }
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_ERROR';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return status >= HttpStatus.INTERNAL_SERVER_ERROR ? 'INTERNAL' : 'ERROR';
  }
}
