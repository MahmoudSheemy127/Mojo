# Backend Code Design — NestJS

> Phase 4 · Detailed Design (Backend). The build spec for the API + realtime server.
> Pairs with: the API contract (`api-contract/`), the Prisma schema
> (`prisma-schema-design.md`), and the realtime persist-then-broadcast design.

---

## 0. Key decisions (read first)

1. **NestJS on the Express platform adapter** (`@nestjs/platform-express`), **not Fastify**.
   Reason: `@nestjs/websockets` + `@nestjs/platform-socket.io` does not expose a reachable
   Socket.io endpoint under the Fastify adapter. Socket.io is core to this app, so Express
   adapter it is.
2. **Domain services never touch the socket layer directly.** They persist to Postgres,
   then emit an in-process event with `@nestjs/event-emitter`. A listener in
   `RealtimeModule` turns those into Socket.io broadcasts. This enforces persist-then-ack
   (NF-16) and removes circular deps between feature modules and the gateway.
3. **Validation = Zod via `nestjs-zod`.** Keeps schema parity with the frontend and the
   contract (which is written in Zod-style types). DTOs are `createZodDto(schema)` classes.
   (class-validator is the conventional alternative if the team prefers decorators.)
4. **Auth = `@nestjs/passport` + `@nestjs/jwt`.** Access JWT (≤15 min) in the
   `Authorization` header; rotating refresh token in an httpOnly cookie; refresh token
   hashes stored in the `Token` table.
5. **One monolith, modular inside.** Each contract domain is a Nest feature module.

---

## 1. Dependencies

```bash
# ── Runtime ──────────────────────────────────────────────
npm i @nestjs/core @nestjs/common @nestjs/platform-express \
      @nestjs/platform-socket.io @nestjs/websockets socket.io \
      @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt \
      passport-google-oauth20 \
      @nestjs/event-emitter @nestjs/throttler \
      @prisma/client nestjs-zod zod \
      ioredis @socket.io/redis-adapter \
      argon2 ulid cookie-parser helmet compression \
      nestjs-pino pino-http pino

# ── Dev ──────────────────────────────────────────────────
npm i -D @nestjs/cli @nestjs/testing @nestjs/schematics \
      prisma typescript ts-node ts-loader tsconfig-paths source-map-support \
      jest ts-jest @types/jest supertest @types/supertest socket.io-client \
      @types/node @types/passport-jwt @types/passport-google-oauth20 \
      @types/cookie-parser @types/compression \
      eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

Why each non-obvious one is here: `@nestjs/event-emitter` (decoupled persist→broadcast),
`@nestjs/throttler` + `ioredis` (distributed rate limiting, NF-11), `@socket.io/redis-adapter`
(WS fan-out across instances, NF-05), `argon2` (password hashing, NF-09), `ulid` (sortable
message ids), `nestjs-pino` (structured JSON logs + correlation ids, NF-20), `helmet` +
HTTPS/WSS at the proxy (NF-08).

---

## 2. Project structure

```
chat-api/
├── prisma/
│   ├── schema.prisma                 # the Phase 4 schema (see prisma-schema-design.md)
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── main.ts                       # bootstrap (§4)
│   ├── app.module.ts                 # root module wiring (§4)
│   │
│   ├── config/
│   │   ├── configuration.ts          # typed config factory
│   │   └── env.validation.ts         # Zod schema validating process.env at boot
│   │
│   ├── prisma/
│   │   ├── prisma.module.ts          # @Global, exports PrismaService
│   │   └── prisma.service.ts         # extends PrismaClient, onModuleInit connect
│   │
│   ├── redis/
│   │   ├── redis.module.ts           # @Global, exports RedisService + pub/sub clients
│   │   └── redis.service.ts          # ioredis wrapper (cache, presence, throttler store)
│   │
│   ├── common/                       # cross-cutting (§6)
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts           # @Public() — opt out of global JwtAuthGuard
│   │   │   ├── current-user.decorator.ts     # @CurrentUser() param decorator
│   │   │   └── group-roles.decorator.ts      # @GroupRoles('ADMIN')
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts             # global; honors @Public()
│   │   │   ├── group-role.guard.ts          # checks Member.role for :groupId
│   │   │   └── ws-jwt.guard.ts               # authenticates socket handshakes
│   │   ├── filters/
│   │   │   ├── all-exceptions.filter.ts      # → ApiError envelope (contract §error)
│   │   │   └── prisma-exception.filter.ts    # P2002 → 409 CONFLICT, etc.
│   │   ├── interceptors/
│   │   │   └── correlation-id.interceptor.ts # attaches/propagates request id
│   │   ├── pipes/
│   │   │   └── (ZodValidationPipe from nestjs-zod, registered globally)
│   │   ├── dto/
│   │   │   └── pagination.dto.ts             # { cursor?, limit? }
│   │   ├── utils/
│   │   │   ├── ulid.ts                        # newUlid()
│   │   │   ├── dm-key.ts                      # canonicalDmKey(a, b) — sorted pair
│   │   │   ├── cursor.ts                      # encode/decode keyset cursors
│   │   │   └── hash.ts                        # argon2 hash/verify, token hashing
│   │   └── types/
│   │       └── socket-events.ts              # ServerToClientEvents / ClientToServerEvents
│   │
│   ├── events/
│   │   └── app-events.ts             # internal event names + payload types (§7)
│   │
│   ├── modules/
│   │   ├── auth/                     # §5
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── token.service.ts      # issue / rotate / revoke refresh tokens
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts            # access token
│   │   │   │   ├── jwt-refresh.strategy.ts    # refresh cookie
│   │   │   │   └── google.strategy.ts         # OAuth
│   │   │   ├── dto/
│   │   │   │   ├── signup.dto.ts
│   │   │   │   ├── login.dto.ts
│   │   │   │   ├── reset-request.dto.ts
│   │   │   │   └── reset-confirm.dto.ts
│   │   │   ├── auth.service.spec.ts
│   │   │   └── auth.controller.spec.ts
│   │   │
│   │   ├── users/
│   │   │   ├── users.module.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   ├── dto/
│   │   │   │   ├── update-profile.dto.ts
│   │   │   │   ├── set-presence.dto.ts
│   │   │   │   └── search-users.dto.ts
│   │   │   └── users.service.spec.ts
│   │   │
│   │   ├── contacts/
│   │   │   ├── contacts.module.ts
│   │   │   ├── contacts.controller.ts
│   │   │   ├── contacts.service.ts           # incl. canInteract() block guard
│   │   │   ├── dto/{send-request,block-user}.dto.ts
│   │   │   └── contacts.service.spec.ts
│   │   │
│   │   ├── conversations/
│   │   │   ├── conversations.module.ts
│   │   │   ├── conversations.controller.ts
│   │   │   ├── conversations.service.ts      # list, get, open-or-create DM, mark read
│   │   │   ├── dto/{open-dm,mark-read}.dto.ts
│   │   │   └── conversations.service.spec.ts
│   │   │
│   │   ├── messages/
│   │   │   ├── messages.module.ts
│   │   │   ├── messages.controller.ts
│   │   │   ├── messages.service.ts           # persist-then-emit (§7)
│   │   │   ├── attachments.service.ts        # P3 uploads
│   │   │   ├── dto/{send-message,list-messages}.dto.ts
│   │   │   └── messages.service.spec.ts
│   │   │
│   │   ├── groups/
│   │   │   ├── groups.module.ts
│   │   │   ├── groups.controller.ts
│   │   │   ├── groups.service.ts
│   │   │   ├── members.service.ts            # roles, add/remove/leave, last-admin rule
│   │   │   ├── invites.service.ts            # links + join requests
│   │   │   ├── dto/{create-group,update-group,invite,change-role}.dto.ts
│   │   │   └── groups.service.spec.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.module.ts
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.service.ts      # create-on-side-effect + feed + count
│   │   │   └── notifications.service.spec.ts
│   │   │
│   │   ├── presence/
│   │   │   ├── presence.module.ts
│   │   │   └── presence.service.ts           # Redis connection tracking + status
│   │   │
│   │   └── realtime/                 # §7
│   │       ├── realtime.module.ts
│   │       ├── realtime.gateway.ts           # connection lifecycle + inbound events
│   │       ├── realtime.listener.ts          # @OnEvent → server.emit (outbound)
│   │       └── adapters/
│   │           └── redis-io.adapter.ts       # Socket.io Redis adapter (NF-05)
│   │
│   └── health/
│       └── health.controller.ts      # GET /health (liveness/readiness)
│
├── test/                             # e2e (§8)
│   ├── auth.e2e-spec.ts
│   ├── messages.e2e-spec.ts
│   ├── realtime.e2e-spec.ts
│   └── jest-e2e.json
│
├── .env.example
├── docker-compose.yml                # postgres + redis for local dev
├── Dockerfile
├── nest-cli.json
├── tsconfig.json
├── jest.config.ts                    # unit test config (coverage ≥70%, NF)
├── eslint.config.mjs
└── package.json
```

Mapping to the request: controllers/services/dtos live inside each `modules/<domain>/`
(point 1–3); Prisma models in `prisma/schema.prisma` (point 4); the auth layer in
`modules/auth/` + `common/guards` + `common/decorators` (point 5); utils in `common/utils`
(point 6); tests as co-located `*.spec.ts` plus `test/*.e2e-spec.ts` (point 7).

---

## 3. Module dependency graph

```
AppModule
├── ConfigModule (global)        env + typed config
├── PrismaModule (global)        PrismaService
├── RedisModule (global)         RedisService, pub/sub clients
├── EventEmitterModule (global)  in-process domain events
├── ThrottlerModule (global)     rate limiting (Redis store)
├── LoggerModule (nestjs-pino)   structured logs + correlation id
│
├── AuthModule          → Prisma, Redis(Token), Jwt, Passport
├── UsersModule         → Prisma, EventEmitter (presence change)
├── ContactsModule      → Prisma, EventEmitter
├── ConversationsModule → Prisma, EventEmitter, ContactsModule (block guard)
├── MessagesModule      → Prisma, ConversationsModule, EventEmitter
├── GroupsModule        → Prisma, ContactsModule, EventEmitter
├── NotificationsModule → Prisma, EventEmitter
├── PresenceModule      → Redis, Prisma, EventEmitter
└── RealtimeModule      → ConversationsModule, PresenceModule, (listens to all events)
```

Note the one-directional flow: domain modules depend on `EventEmitter`, never on
`RealtimeModule`. `RealtimeModule` depends on a few domain modules for **inbound** socket
handling (read markers, presence) and **listens** to events for outbound — no cycles.

---

## 4. Bootstrap & root module

`main.ts` responsibilities:
- Create the app with the Express adapter; set global prefix `/api`.
- `app.useGlobalPipes(new ZodValidationPipe())` (from nestjs-zod).
- `app.useGlobalFilters(new AllExceptionsFilter(), new PrismaExceptionFilter())`.
- `app.use(cookieParser())`, `app.use(helmet())`, `app.use(compression())`.
- `app.enableCors({ origin: config.webOrigin, credentials: true })` (refresh cookie).
- `app.useWebSocketAdapter(new RedisIoAdapter(app))` then `await adapter.connectToRedis()`.
- `app.enableShutdownHooks()` (graceful drain of sockets + Prisma).
- Pino logger as the app logger.

```ts
// app.module.ts (shape)
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, load: [configuration] }),
    LoggerModule.forRoot({ /* pino: genReqId for correlation id */ }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRootAsync({ /* Redis storage; default + auth limits */ }),
    PrismaModule, RedisModule,
    AuthModule, UsersModule, ContactsModule, ConversationsModule,
    MessagesModule, GroupsModule, NotificationsModule, PresenceModule,
    RealtimeModule, HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },     // auth by default
    { provide: APP_GUARD, useClass: ThrottlerGuard },   // rate limit by default
  ],
})
export class AppModule {}
```

---

## 5. Auth layer (point 5)

Implements the contract's `auth.md`. Token model: access JWT (≤15 min), rotating refresh
token in httpOnly cookie, refresh hashes persisted in `Token (type=REFRESH)`.

- `JwtAuthGuard` is a **global** `APP_GUARD`. Routes opt out with `@Public()`
  (login, signup, refresh, password-reset, OAuth, health).
- `JwtStrategy` validates the access token, loads the user, attaches it to the request;
  `@CurrentUser()` reads it in controllers.
- `JwtRefreshStrategy` reads the refresh cookie, verifies the stored hash, and is used only
  by `POST /auth/refresh`.
- `GoogleStrategy` handles `GET /auth/google` + callback (FR-02); on callback the service
  finds/creates the `User` + `Account` + `OAuthAccount`, issues tokens, sets the cookie.
- `GroupRoleGuard` + `@GroupRoles('ADMIN')` protect admin-only group endpoints
  (FR-20/21/23); it reads `:groupId`, looks up `Member.role`, throws `403 FORBIDDEN` if not.
- `WsJwtGuard` authenticates the Socket.io handshake (token in `handshake.auth.token`).

`TokenService` responsibilities: `issuePair(userId)`, `rotateRefresh(oldToken)` (revoke old,
mint new, chain via `replacedById`), `revoke(tokenId)` (logout, FR-03),
`revokeAllForUser(userId)` (logout-everywhere), plus password-reset token issue/consume
(FR-04, single-use via `usedAt`). All tokens stored **hashed**, never raw.

DTO example (nestjs-zod):
```ts
export const SignupSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8),
  acceptedTerms: z.literal(true),
});
export class SignupDto extends createZodDto(SignupSchema) {}
```

`@Throttle()` overrides on auth endpoints enforce ≤10 req/min/IP (NF-11).

---

## 6. Common / cross-cutting (point 6: utils & friends)

- `AllExceptionsFilter` maps every error to the contract's envelope
  `{ error: { code, message, details? } }` with the right status. `PrismaExceptionFilter`
  translates Prisma codes (e.g. `P2002` unique violation → `409 CONFLICT`,
  `P2025` not found → `404`).
- `CorrelationIdInterceptor` / pino `genReqId` attach a request id to every log line (NF-20);
  message **content is never logged** (NF-15).
- `common/utils`: `newUlid()` (message ids), `canonicalDmKey(a,b)` (sorted pair → the
  `Conversation.dmKey` that enforces one DM per pair), `cursor.ts` (encode/decode keyset
  cursors for pagination), `hash.ts` (argon2 + token hashing).
- `common/types/socket-events.ts` declares typed `ServerToClientEvents` and
  `ClientToServerEvents` (the exact event names from `realtime.md`), shared by the gateway
  and listener so emits/handlers are type-checked.

---

## 7. Realtime module (the persist-then-broadcast core)

Three pieces:

1. **`RedisIoAdapter`** — extends Nest's `IoAdapter`, wires `@socket.io/redis-adapter` with
   two `ioredis` clients (pub + sub) so broadcasts reach sockets on any instance (NF-05).

2. **`RealtimeGateway`** — `@WebSocketGateway()` with `WsJwtGuard`:
   - `handleConnection`: verify token, `socket.join('user:'+userId)` and join each
     conversation room the user belongs to; mark presence online (PresenceService) and emit
     `presence:changed`.
   - `handleDisconnect`: decrement presence; after a grace period with no sockets, mark
     offline + emit `presence:changed`.
   - `@SubscribeMessage('typing:start' | 'typing:stop')`: relay to the conversation room,
     excluding the sender (FR-15).
   - `@SubscribeMessage('message:read')`: call `ConversationsService.markRead(...)`, which
     persists the marker and emits `message:status` to senders (FR-14).
   - **No message *send* handler** — send is REST (persist-before-ack, NF-16).

3. **`RealtimeListener`** — `@OnEvent(...)` handlers that turn internal domain events into
   outbound Socket.io emits:

| Internal event (emitted by) | Socket emit | Room |
|---|---|---|
| `message.created` (MessagesService) | `message:new` | `conversation:<id>` (except sender) |
| `message.deleted` (MessagesService) | `message:deleted` | `conversation:<id>` |
| `message.read` (ConversationsService) | `message:status` | sender's `user:<id>` |
| `presence.changed` (PresenceService) | `presence:changed` | each contact's `user:<id>` |
| `notification.created` (NotificationsService) | `notification:new` | `user:<recipientId>` |
| `conversation.created` (Conversations/Groups) | `conversation:new` | new participants |
| `group.updated` (GroupsService) | `group:updated` | `conversation:<id>` |
| `group.deleted` (GroupsService) | `group:deleted` | members |
| `member.added/removed/role_changed` (MembersService) | `member:*` | members + target |

The canonical write path, e.g. in `MessagesService.send()`:
```ts
async send(userId, conversationId, dto) {
  await this.assertCanPost(userId, conversationId);          // membership + block guard
  const message = await this.prisma.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { id: newUlid(), /* ... */ } });
    await tx.conversation.update({                            // denormalized preview
      where: { id: conversationId },
      data: { lastMessageId: m.id, lastActivityAt: m.createdAt },
    });
    return m;
  });
  this.events.emit(AppEvent.MESSAGE_CREATED, { message });    // AFTER commit only
  // mentions → this.events.emit(AppEvent.NOTIFICATION_CREATED, …)
  return message;                                             // 201 = the durable ack
}
```
Commit first, emit second, return third. The gateway/listener never run before the row is
safe in Postgres.

---

## 8. Feature modules → contract endpoints

Each controller maps 1:1 to its contract file. Controllers stay thin (validate + delegate);
all logic lives in services.

| Module | Controller routes (→ contract) | Service responsibilities |
|---|---|---|
| **auth** | signup, login, refresh, logout, google, password-reset/* | credentials, OAuth, token lifecycle |
| **users** | GET/PATCH `/users/me`, PUT avatar, PATCH presence, GET search, GET `/users/:id` | profile, presence write, user search (block-filtered) |
| **contacts** | requests CRUD, `/contacts/:id` DELETE, blocks CRUD | friend graph, `canInteract()` block guard (reused everywhere) |
| **conversations** | GET list/`:id`, POST `/dm`, POST `/:id/read` | session list (+unread), open-or-create DM, read markers |
| **messages** | GET/POST `/conversations/:id/messages`, DELETE `/messages/:id`, POST `/attachments` | history (keyset), send (persist→emit), soft-delete, uploads |
| **groups** | POST/GET/PATCH/DELETE `/groups`, members add/remove/role, invite-link, join | group lifecycle, roles, last-admin rule, invites |
| **notifications** | GET list/count, POST seen | feed, unread count, create-on-side-effect |
| **presence** | (no REST of its own; PATCH presence lives in users) | Redis connection tracking, effective status |

DTOs per module sit in `dto/` and are Zod-schema classes mirroring the contract request
bodies (e.g. `SendMessageDto`, `CreateGroupDto`, `ChangeRoleDto`, `OpenDmDto`,
`PaginationDto`).

---

## 9. Prisma models (point 4)

Use the schema in `prisma-schema-design.md` verbatim as `prisma/schema.prisma`. Workflow:
`prisma migrate dev` for local migrations, `prisma generate` for the client,
`prisma migrate deploy` in CI/prod. `PrismaService` extends `PrismaClient` and connects in
`onModuleInit`. `prisma/seed.ts` creates a couple of users + a DM + a group for local dev.
The hot read paths (message history keyset on `(conversationId, id)`, conversation list)
may drop to `prisma.$queryRaw` if the generated query underperforms.

---

## 10. Testing (point 7)

Target: backend coverage **≥70%** (NF-19).

- **Unit (`*.service.spec.ts`)** — the bulk. Instantiate a service with a mocked
  `PrismaService` and a mocked `EventEmitter2`; assert business rules (block guard rejects,
  last-admin rule, persist-before-emit ordering, mention → notification). Fast, no DB.
- **Controller (`*.controller.spec.ts`)** — mock the service; assert routing, guards, and
  DTO validation wiring.
- **E2E (`test/*.e2e-spec.ts`)** — boot the full app with `Test.createTestingModule` against
  a disposable Postgres + Redis (Docker Compose or Testcontainers), exercise real HTTP via
  `supertest`. Cover: signup→login→refresh→logout; send message persists and returns 201;
  block prevents DM.
- **Realtime e2e (`realtime.e2e-spec.ts`)** — connect with `socket.io-client`, assert that a
  REST `POST message` causes the recipient socket to receive `message:new`, and that typing
  relays. This is the test that proves persist-then-broadcast end to end.

CI runs `lint → unit → e2e (with services) → coverage gate`.

---

## 11. Config, scripts, tooling

`.env.example`:
```bash
DATABASE_URL=postgresql://app:app@localhost:5432/chat
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=...
JWT_ACCESS_TTL=900            # 15 min
JWT_REFRESH_SECRET=...
JWT_REFRESH_TTL=2592000       # 30 days
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
WEB_ORIGIN=http://localhost:5173
COOKIE_DOMAIN=localhost
PORT=4000
```
`env.validation.ts` parses this with Zod at boot and fails fast on a missing var.

`package.json` scripts: `start:dev` (watch), `build`, `start:prod`, `prisma:migrate`,
`prisma:generate`, `prisma:seed`, `test`, `test:e2e`, `test:cov`, `lint`, `format`.

`docker-compose.yml` provides `postgres:16` and `redis:7` for local dev and e2e.

---

## 12. Suggested build order for Claude Code

1. Scaffold (`nest new`), tsconfig paths, eslint/prettier, docker-compose.
2. `PrismaModule` + schema + first migration + seed.
3. `RedisModule`, `ConfigModule` + env validation, pino logger.
4. `common/` (filters → ApiError envelope, ZodValidationPipe, decorators, utils).
5. `AuthModule` (strategies, guards, TokenService) + global `JwtAuthGuard` + `@Public()`.
6. `UsersModule`, then `ContactsModule` (incl. `canInteract()` block guard).
7. `ConversationsModule`, then `MessagesModule` (persist→emit).
8. `RealtimeModule` (Redis adapter, gateway, listener) — wire `message:new` first.
9. `GroupsModule`, `NotificationsModule`, `PresenceModule`.
10. Throttler limits on auth; health endpoint.
11. Tests alongside each module; e2e + realtime e2e last.

Build vertically: get one end-to-end slice (login → open DM → send → recipient receives over
socket → reload reads from DB) working before fanning out to groups/notifications.
