// src/common/filters/ws-exceptions.filter.ts
import { ArgumentsHost, Catch } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/nestjs';
import type { Socket } from 'socket.io';

/**
 * WebSocket counterpart to AllExceptionsFilter (docs/observability.md §7). The HTTP
 * filter does NOT catch errors thrown inside @SubscribeMessage handlers — those flow
 * through Nest's WS exception path. For a chat app that's half the surface area, so
 * unexpected throws here are logged at `error` and captured to Sentry; expected
 * WsExceptions are passed through untouched (the system working correctly).
 *
 * NOT wired yet: apply with `@UseFilters(WsAllExceptionsFilter)` on the gateway once
 * src/modules/realtime/realtime.gateway.ts is implemented. `client.data.userId` is
 * expected to be set at handshake by WsJwtGuard.
 */
@Catch()
export class WsAllExceptionsFilter extends BaseWsExceptionFilter {
  constructor(@InjectPinoLogger(WsAllExceptionsFilter.name) private readonly logger: PinoLogger) {
    super();
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    const isExpected = exception instanceof WsException;

    if (!isExpected) {
      this.logger.error({ err: exception, socketId: client.id }, 'ws handler error');
      Sentry.captureException(exception, (scope) => {
        scope.setTag('transport', 'websocket');
        const userId = (client.data as { userId?: string } | undefined)?.userId;
        if (userId) scope.setUser({ id: userId }); // id only — no email/content (NF-15)
        return scope;
      });
    }

    super.catch(exception, host); // still emit the WS error frame to the client
  }
}
