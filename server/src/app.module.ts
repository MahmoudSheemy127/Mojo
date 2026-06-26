// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { configuration } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { MessagesModule } from './modules/messages/messages.module';
import { GroupsModule } from './modules/groups/groups.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { RealtimeModule } from '@modules/realtime/realtime.module';
import { PresenceModule } from '@modules/presence/presence.module';
import { RedisModule } from '@redis/redis.module';

@Module({
  imports: [
    // Sentry request-scope isolation + Nest instrumentation (init lives in instrument.ts).
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, load: [configuration] }),
    // Structured logging with a correlation id threaded through every log line (NF-20).
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',

        // Correlation id: honor an inbound x-correlation-id, else mint one, and echo it.
        // pino is the single source of the id — the CorrelationIdInterceptor reads req.id.
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const header = req.headers['x-correlation-id'];
          const id = (Array.isArray(header) ? header[0] : header) ?? randomUUID();
          res.setHeader('x-correlation-id', id);
          return id;
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
            'req.body.content', // message text
            'req.body.token',
            '*.passwordHash',
            '*.accessToken',
            '*.refreshToken',
          ],
          censor: '[redacted]',
        },

        // Trim noisy fields; keep the correlation id + essentials.
        serializers: {
          req(req: { id: unknown; method: unknown; url: unknown }) {
            return { id: req.id, method: req.method, url: req.url };
          },
          res(res: { statusCode: unknown }) {
            return { statusCode: res.statusCode };
          },
        },

        // Health checks shouldn't spam logs (global prefix is /api).
        autoLogging: {
          ignore: (req: IncomingMessage) => (req.url ?? '').startsWith('/api/health'),
        },
      },
    }),
    EventEmitterModule.forRoot(),
    // Default cap; auth endpoints tighten to 10/min via @Throttle (NF-11).
    // In-memory store for now — swap to a Redis store for multi-instance (NF-05).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    GroupsModule,
    NotificationsModule,
    HealthModule,
    RealtimeModule,
    PresenceModule,
    RedisModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard }, // auth by default; @Public() opts out
    // Bind the global ThrottlerGuard via `useExisting` (not `useClass`) so e2e/contract
    // tests can neutralize rate limiting with `overrideGuard(ThrottlerGuard)` — an override
    // cannot reach a guard bound with `useClass` on APP_GUARD. Production behavior is
    // unchanged: a single ThrottlerGuard still runs on every route (NF-11).
    ThrottlerGuard,
    { provide: APP_GUARD, useExisting: ThrottlerGuard }, // rate limit by default
    // APP_FILTER-bound filters run in reverse registration order, so the specific
    // PrismaExceptionFilter (declared last) is tried before the catch-all.
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
