# Observability — NestJS Backend

> Phase 4 · Detailed Design (Operational Excellence). How structured logging (pino)
> and error tracking + tracing (Sentry) are wired into the chat API. Pairs with the
> backend design (`backend-design-nestjs.md`) and the realtime design.

The goal is three signals, each answering a different question:
- **Logs** (pino) — "what happened in this one request?"
- **Errors** (Sentry) — "what threw, how often, who hit it, is it new?"
- **Traces** (Sentry) — "where did the time go across this request's spans?"

The exception filter is one *emission point* (it calls into Sentry + logs), not the
whole strategy. Metrics (Prometheus/Grafana) are deferred until beta traffic and are out
of scope here.

---

## 1. Dependencies

```bash
npm install nestjs-pino pino pino-http @sentry/nestjs @sentry/profiling-node
# dev only: prettier log output locally
npm install --save-dev pino-pretty
```

- `nestjs-pino` — Nest logger backed by pino, with per-request child loggers and
  automatic request-id propagation.
- `@sentry/nestjs` — the official NestJS SDK (wraps `@sentry/node`); provides tracing
  integration and a Nest exception capture path.
- `@sentry/profiling-node` — optional CPU profiling attached to traces.

---

## 2. Environment

```bash
# .env additions
SENTRY_DSN=                      # empty in local/dev disables Sentry cleanly
SENTRY_ENVIRONMENT=development   # development | staging | production
SENTRY_TRACES_SAMPLE_RATE=0.1    # 10% of requests traced (tune per env)
SENTRY_PROFILES_SAMPLE_RATE=0.1  # relative to traced requests
LOG_LEVEL=debug                  # debug local, info staging, warn/info prod
```

Add these to `env.validation.ts` (Zod). `SENTRY_DSN` is optional — when absent, Sentry
init is skipped so local dev and tests never emit.

---

## 3. Sentry must initialize BEFORE the app

`@sentry/nestjs` instruments modules via import-time hooks, so initialization has to run
**before** anything else is imported. Put it in its own file and import it first in
`main.ts`.

```ts
// src/instrument.ts  — imported at the very top of main.ts, before AppModule
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
    // Never let message content leak into error reports (NF-15).
    sendDefaultPii: false,
    beforeSend(event) {
      // Defense in depth: strip request bodies from captured events.
      if (event.request) delete event.request.data;
      return event;
    },
  });
}
```

```ts
// src/main.ts
import './instrument';            // <-- FIRST import, no exceptions
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
// ... rest of bootstrap

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));     // pino becomes the Nest logger
  // ... cookieParser, helmet, filters, RedisIoAdapter, etc.
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
```

> `bufferLogs: true` holds early framework logs until the pino logger is attached, so
> nothing is lost during boot.

---

## 4. pino — structured logging with correlation ids

Register `LoggerModule` globally in `app.module.ts`. The key piece is `genReqId`: it
assigns (or reuses) a correlation id per request, which becomes the thread connecting a
log line, a Sentry issue, and the client's error response.

```ts
// app.module.ts (excerpt)
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';

LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL ?? 'info',

    // Correlation id: honor an inbound header, else mint one.
    genReqId: (req, res) => {
      const existing = (req.headers['x-request-id'] as string) ?? randomUUID();
      res.setHeader('x-request-id', existing);
      return existing;
    },

    // Pretty in dev, JSON in prod.
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { singleLine: true } }
        : undefined,

    // NF-15: never log message content, passwords, tokens, or cookies.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'req.body.password',
        'req.body.newPassword',
        'req.body.content',          // message text
        'req.body.token',
        '*.passwordHash',
        '*.accessToken',
        '*.refreshToken',
      ],
      censor: '[redacted]',
    },

    // Trim noisy fields; keep the correlation id + essentials.
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },

    // Health checks shouldn't spam logs.
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  },
});
```

What this gives you:
- Every HTTP request logs start/finish with `reqId`, method, url, status, duration.
- Inside any service, inject the logger and child-log with the same `reqId`
  automatically:
  ```ts
  constructor(private readonly logger: PinoLogger) {}
  // this.logger.info({ conversationId }, 'message persisted');
  // → carries the request's reqId, no manual plumbing
  ```
- Secrets and message bodies are redacted at the logger, not by remembering to omit them.

---

## 5. Sentry ↔ correlation id

Tie each Sentry event to the same `reqId` so you can pivot from a Sentry issue to the
exact log line. Do it in a small middleware (or the exception filter) that runs per
request:

```ts
// set on the Sentry scope once per request
Sentry.getCurrentScope().setTag('request_id', req.id);
// when authenticated, attach a non-PII user handle for grouping
Sentry.getCurrentScope().setUser({ id: userId });   // id only — no email/content
```

Now a production incident reads: open the Sentry issue → copy `request_id` → grep the
log store for that id → full request story.

---

## 6. The exception filter — emit, but gate on severity

The `AllExceptionsFilter` does three things: map to the `ApiError` envelope (for the
client), log, and forward to Sentry — **but only 5xx**. A `404` or `422 VALIDATION_ERROR`
is the system working correctly; sending those to Sentry buries real bugs.

```ts
// common/filters/all-exceptions.filter.ts (shape)
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger() private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const req = ctx.getRequest();

    const { status, code, message } = mapError(exception); // → envelope fields

    if (status >= 500) {
      // Unexpected: log at error AND capture in Sentry.
      this.logger.error({ err: exception, reqId: req.id, code }, message);
      Sentry.captureException(exception, (scope) => {
        scope.setTag('request_id', req.id);
        scope.setTag('error_code', code);
        return scope;
      });
    } else {
      // Expected client error: log at warn, do NOT send to Sentry.
      this.logger.warn({ reqId: req.id, status, code }, message);
    }

    res.status(status).json({ error: { code, message } });
  }
}
```

Rule of thumb: **Sentry sees only what you'd want to be paged about.** Validation
failures, auth rejections, not-found — logged, never captured.

---

## 7. The WebSocket gap — easy to miss

The HTTP `AllExceptionsFilter` does **not** catch errors thrown inside Socket.io gateway
handlers (`@SubscribeMessage`). Those flow through Nest's WS exception path. For a chat
app this is half the surface area, so add a WS filter that captures to Sentry too.

```ts
// common/filters/ws-exceptions.filter.ts (shape)
@Catch()
export class WsAllExceptionsFilter extends BaseWsExceptionFilter {
  constructor(@InjectPinoLogger() private readonly logger: PinoLogger) { super(); }

  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient();
    const isExpected = exception instanceof WsException;

    if (!isExpected) {
      this.logger.error({ err: exception, socketId: client.id }, 'ws handler error');
      Sentry.captureException(exception, (scope) => {
        scope.setTag('transport', 'websocket');
        scope.setUser({ id: client.data?.userId });  // set at handshake
        return scope;
      });
    }
    super.catch(exception, host);   // still emit the WS error frame to the client
  }
}
```

Apply it on the gateway: `@UseFilters(WsAllExceptionsFilter)`. Without this, a crash in a
`message:read` or typing handler is invisible to Sentry.

---

## 8. Tracing — and the persist-then-broadcast seam

`@sentry/nestjs` auto-instruments HTTP routes and (with the Prisma integration) DB
queries, so most spans appear for free. The one span worth adding **manually** is the
chat app's defining operation: send-message, which spans persist → commit → emit. A
custom span around it lets you see, per message, how long the DB commit took versus the
socket fan-out — directly relevant to the NF-01 ≤200ms delivery target.

```ts
// messages.service.ts (excerpt)
async send(userId: string, conversationId: string, dto: SendMessageDto) {
  return Sentry.startSpan({ name: 'message.send', op: 'chat.send' }, async (span) => {
    const message = await Sentry.startSpan(
      { name: 'message.persist', op: 'db.commit' },
      () => this.persist(userId, conversationId, dto),   // commit FIRST (NF-16)
    );
    span?.setAttribute('conversationId', conversationId);

    // emit AFTER commit — the broadcast is a child span, never before persist
    Sentry.startSpan({ name: 'message.broadcast', op: 'ws.emit' }, () =>
      this.events.emit(AppEvent.MESSAGE_CREATED, { message }),
    );
    return message;
  });
}
```

This makes the persist-before-broadcast ordering observable: in the trace waterfall the
`db.commit` span always closes before `ws.emit` opens. If they ever invert, the trace
shows it.

Sampling: keep `tracesSampleRate` low (≈0.1) in production — tracing every request is
expensive and unnecessary. Errors are captured at 100% regardless of trace sampling.

---

## 9. Health probes (feed future Grafana, not Sentry)

Add a `/health` endpoint with liveness and readiness so the platform (and later
Prometheus) can poll it. It checks DB + Redis reachability and is excluded from request
logging (§4).

```
GET /health          → 200 { status: 'ok' }                    (liveness)
GET /health/ready    → 200 when Postgres + Redis reachable,     (readiness)
                       503 otherwise
```

Use `@nestjs/terminus` for the readiness checks if you want batteries-included DB/Redis
indicators.

---

## 10. What goes where — quick reference

| Signal | Tool | Source in code | Answers |
|---|---|---|---|
| Structured logs | pino | `LoggerModule` + injected `PinoLogger` | "what happened in request `<reqId>`" |
| Client errors (4xx) | pino only | exception filters (warn) | request hygiene; never paged |
| Server errors (5xx) | Sentry + pino | HTTP + WS exception filters | "what threw, how often, who, is it new" |
| Traces / spans | Sentry | auto + `message.send` manual span | "where did the latency go" |
| Liveness/readiness | `/health` | terminus controller | "is the process up + deps reachable" |
| Metrics (rate, p95, WS count) | Prometheus/Grafana | **deferred to beta** | "is the system healthy in aggregate" |

---

## 11. Implementation checklist

- [ ] `src/instrument.ts` created; imported as the **first** line of `main.ts`.
- [ ] `SENTRY_DSN` optional in env validation; absent ⇒ Sentry disabled (dev/test silent).
- [ ] `LoggerModule.forRoot` with `genReqId`, `redact` (content + secrets), `/health` ignore.
- [ ] `app.useLogger(app.get(Logger))` + `bufferLogs: true`.
- [ ] Per-request Sentry scope: `request_id` tag + `userId` (id only, no PII).
- [ ] HTTP `AllExceptionsFilter`: envelope always; Sentry capture **only** `status >= 500`.
- [ ] WS `WsAllExceptionsFilter` on the gateway; captures non-`WsException` throws.
- [ ] Manual `message.send` span wrapping persist (commit) → broadcast.
- [ ] `tracesSampleRate` low in prod; errors captured at 100%.
- [ ] `/health` + `/health/ready` (terminus), excluded from request logging.
- [ ] Verify in a test: a 422 does NOT reach Sentry; a forced 500 DOES; both carry `reqId`.
