# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This is a **scaffolded-but-unimplemented** NestJS chat backend. The full directory tree
under `src/` exists, but nearly every `.ts` file is an **empty placeholder** — the actual
implementation has not been written yet. The authoritative specification for what each file
should contain lives in the design docs:

- `docs/BE/backend-design-nestjs.md` — the build spec: module graph, bootstrap wiring, auth
  layer, realtime persist-then-broadcast core, testing strategy, and a suggested build order.
- `docs/ERD/prisma-schema-design.md` — the complete Prisma schema (paste verbatim into
  `prisma/schema.prisma`) with rationale for every constraint and index.
- `docs/api/*.md` — the REST + realtime API contract, one file per domain.

When implementing, **read the relevant design doc first** — these documents are the source of
truth, not the empty stubs. `scripts/check-structure.mjs` enforces that the required file
paths from the design exist.

## Commands

```bash
# Local infra (Postgres 16 + Redis 7)
docker compose up -d

# Dev
npm run start:dev          # watch mode (nest start --watch)
npm run start:prod         # node dist/main

# Prisma (schema lives in prisma/schema.prisma, designed in docs/ERD/)
npm run prisma:migrate     # migrate dev (local)
npm run prisma:generate
npm run prisma:reset       # migrate reset --force
npm run prisma:seed        # ts-node prisma/seed.ts
npm run prisma:deploy      # migrate deploy (CI/prod)

# Quality
npm run typecheck          # tsc --noEmit
npm run lint               # eslint .
npm run format             # prettier --write

# Tests — Jest is configured as multiple projects (jest.config.ts), select by name:
npm run test               # unit only (default)
npm run test:integration   # *.integration.spec.ts
npm run test:schema        # test/schema-*.spec.ts
npm run test:contract      # test/contract-*.spec.ts
npm run test:realtime      # test/realtime-*.spec.ts
npm run test:cov           # unit + coverage (gate: ≥70% lines/branches/functions/statements)

# Run a single test file / test name:
npx jest --selectProjects unit path/to/file.spec.ts
npx jest --selectProjects unit -t "test name substring"
```

### Verification gates

`package.json` defines composite gates that mirror CI. Run the relevant one before
considering a feature done:

- `gate:scaffold` — `npm ci` + build + typecheck + lint + `check-structure.mjs`
- `gate:schema` — prisma reset + generate + schema tests
- `gate:backend` — typecheck, lint, contract/realtime/unit/integration tests, coverage, `npm audit`
- `gate:be-feature` — runs all three in order (the full pre-merge gate)

## Test layout

Tests are split into Jest **projects** (see `jest.config.ts`), not just folders:

- **unit** — co-located `src/**/*.spec.ts`. Instantiate a service with a mocked
  `PrismaService` and mocked `EventEmitter2`; assert business rules. No DB.
- **integration** — `src/**/*.integration.spec.ts`.
- **schema / contract / realtime** — `test/{schema,contract,realtime}-*.spec.ts`. These boot
  against real Postgres + Redis (from docker compose) and exercise HTTP via `supertest` /
  sockets via `socket.io-client`.

Coverage excludes `*.spec.ts`, `*.module.ts`, and `main.ts`.

## Architecture (from the design docs)

A single modular monolith — NestJS on the **Express** platform adapter (Fastify does not
expose a reachable Socket.io endpoint, and Socket.io is core here).

### Persist-then-broadcast (the central pattern)

Domain services **never touch the socket layer**. The flow is strictly one-directional:

1. A service writes to Postgres inside a `prisma.$transaction`.
2. **After commit**, it emits an in-process event via `@nestjs/event-emitter`
   (event names + payload types in `src/events/app-events.ts`).
3. `RealtimeModule`'s `realtime.listener.ts` has `@OnEvent` handlers that translate those
   domain events into outbound Socket.io emits to the right rooms.

This enforces persist-before-ack (a REST `201` is the durable ack) and removes circular deps:
feature modules depend on `EventEmitter`, never on `RealtimeModule`. `RealtimeModule` depends
on a few domain modules only for **inbound** socket handling (typing, read markers, presence).
There is intentionally **no message-send socket handler** — sending is REST.

The event→emit mapping table is in `docs/BE/backend-design-nestjs.md` §7.

### Cross-instance realtime

`redis-io.adapter.ts` wires `@socket.io/redis-adapter` (pub + sub ioredis clients) so
broadcasts fan out to sockets on any instance. Rooms: `user:<id>` and `conversation:<id>`.

### Auth

- Access JWT (≤15 min) in the `Authorization` header; rotating refresh token in an
  **httpOnly cookie**; refresh-token **hashes** stored in the `Token` table (never raw).
- `JwtAuthGuard` is a **global** `APP_GUARD` — every route is authenticated by default;
  opt out with `@Public()` (login, signup, refresh, reset, OAuth, health).
- `GroupRoleGuard` + `@GroupRoles('ADMIN')` reads `:groupId` → `Member.role` for admin-only
  group endpoints. `WsJwtGuard` authenticates socket handshakes (`handshake.auth.token`).
- `TokenService` owns issue / rotate (chained via `replacedById`) / revoke / revoke-all, plus
  single-use password-reset tokens (`usedAt`).
- `ThrottlerGuard` is also a global `APP_GUARD` (Redis store); auth endpoints override to
  ≤10 req/min/IP.

### Validation

Zod via `nestjs-zod` (keeps parity with the frontend/contract, both Zod-style). DTOs are
`createZodDto(schema)` classes in each module's `dto/`. `ZodValidationPipe` is registered
globally.

### Errors & logging

`AllExceptionsFilter` maps everything to the contract envelope `{ error: { code, message,
details? } }`; `PrismaExceptionFilter` translates Prisma codes (`P2002` → 409, `P2025` → 404).
`nestjs-pino` produces structured JSON logs with a correlation id per request. **Message
content is never logged.**

### Data model highlights (see `docs/ERD/prisma-schema-design.md` for the full schema)

- **`User` (profile) vs `Account` (credentials)** are split 1:1. `username`/`email` live on
  `Account`; user search joins through it.
- **`Message.id` is a ULID** generated in the app layer (`common/utils/ulid.ts`) — no
  `@default`, no sequence column. It is monotonic/sortable, so `(conversationId, id)` is both
  the keyset-pagination index and the reconnect-replay cursor.
- **One DM per pair** is enforced by `Conversation.dmKey` — a canonical sorted
  `"<userA>:<userB>"` string (`common/utils/dm-key.ts`), unique, null for groups.
- **A group IS a conversation** (`Group.conversationId @unique`, 1:1).
- **`Relation`** stores directed edges: `BLOCK` is directional; `FRIEND` symmetric. The
  cross-cutting block guard (`contacts.service.ts` `canInteract()`) reuses this everywhere.
- Models are PascalCase singular; tables are snake_case plural via `@@map`.
- `Message.sender` deliberately has **no cascade** — account deletion is handled in the
  service layer (anonymize/tombstone), not by a blanket `onDelete: Cascade`.

## Path aliases

Defined in both `tsconfig.json` and `jest.config.ts` (keep them in sync):

`@common/*`, `@config/*`, `@events/*`, `@prisma-module/*` (→ `src/prisma`), `@redis/*`,
`@modules/*`.

## Conventions

- Controllers stay thin (validate + delegate); all logic lives in services. Each controller
  maps 1:1 to a contract file in `docs/api/`.
- Emit domain events **after** the DB transaction commits — never before.
- TypeScript is `strict`; the API global prefix is `/api`.
