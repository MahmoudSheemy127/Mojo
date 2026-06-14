// src/common/interceptors/correlation-id.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';

/**
 * Surfaces the per-request correlation id (NF-20) as `req.correlationId` for any
 * code that reads that property. The id itself is minted and echoed on the
 * `x-correlation-id` response header by pino's `genReqId` (see LoggerModule in
 * app.module.ts) — pino is the single source of truth, so this interceptor only
 * re-exposes `req.id` and never logs request/message content (NF-15).
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { id?: string; correlationId?: string }>();

    req.correlationId = req.id;

    return next.handle();
  }
}
