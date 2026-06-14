# Backend — Implementation Plan

> Runs as its own session in the backend directory (`chat-api/`), in parallel with the
> frontend. Build slightly **ahead** of the frontend so a real API + socket gateway exist
> for the joint G4 gate. Each stage links to a gate in `BE-QA-STRATEGY.md`; a stage is
> done only when its gate exits 0 and the tracker shows it green. The agent never writes
> verdicts into the tracker — the gate scripts do.

## Shared source of truth
- **REST contract:** `../contract/openapi.yaml` — the ONLY REST contract. Never copy it.
  Contract-conformance tests are generated/validated FROM this file, independent of impl.
- **Realtime contract:** `../contract/asyncapi.yaml` — the ONLY socket-event contract.
  Realtime conformance tests validate emitted/received events FROM this file.

> Both specs are **derived from** the human-readable design contract in `../contract/*.md`
> (auth, users, contacts, conversations, messages, groups, notifications, realtime). That
> derivation is a **Stage 0 prerequisite** (see below): without the machine-readable specs,
> G2's headline metric cannot run.

## Source documents
| Alias | File | Role |
|---|---|---|
| `@be-design` | `docs/design/be-design.md` | NestJS structure, modules, deps, conventions (from `backend-design-nestjs.md`) |
| `@erd`       | `docs/design/erd.md`       | Prisma schema design (from `prisma-schema-design.md`) |
| `@contract`  | `../contract/openapi.yaml` | Shared REST contract |
| `@events`    | `../contract/asyncapi.yaml`| Shared socket-event contract |

## Stack reminder (from `@be-design`)
NestJS on the **Express** adapter (Socket.io is unreachable on Fastify), Prisma + PostgreSQL,
Redis (Socket.io adapter, presence, rate-limit store), `@nestjs/event-emitter` for the
persist-then-broadcast path, `nestjs-zod` DTOs, Passport (JWT access + rotating refresh).
Test runner: **Jest** (NestJS default), not Vitest.

---

## Features & build order

Features map to the NestJS feature modules. Order respects dependencies; build **vertically**
— get the first end-to-end slice (Auth → Conversations → Messages → Realtime) green before
fanning out.

| # | Feature | Depends on | Notes |
|---|---|---|---|
| 1 | **Auth** | — | tokens, OAuth, password reset; the first slice |
| 2 | **Users & Profile** | Auth | profile, avatar, presence-status write, user search |
| 3 | **Contacts** | Users | friend requests, remove, block/unblock; owns `canInteract()` block guard |
| 4 | **Conversations** | Contacts | DM session list, open-or-create DM, read markers |
| 5 | **Messages** | Conversations | history (keyset), send (persist→emit), soft-delete, attachments (P3) |
| 6 | **Realtime** | Messages, Conversations, Presence | gateway, Redis adapter, persist-then-broadcast, socket events |
| 7 | **Groups** | Contacts | lifecycle, members, roles, invites/links, last-admin rule |
| 8 | **Notifications** | (cross-cuts) | feed, count, create-on-side-effect |
| 9 | **Presence** | Redis | connection tracking, effective status; feeds Realtime |

> **First milestone (vertical slice):** Auth + Conversations + Messages + Realtime, proving
> login → open DM → send → recipient receives `message:new` over the socket → reload reads
> the same row from Postgres. Everything else extends this spine.

---

## Stages (per feature)

The backend uses gates **G0, G1, G2** (its own) plus the **joint G4**. There is no G3 on the
backend — G3 is the frontend's UI gate.

### Stage 0 — Scaffold  →  Gate **G0**  *(project-level, runs once)*
From `@be-design`: folder structure, dependencies, tsconfig, ESLint, Jest projects, Nest CLI
config, `docker-compose.yml` (postgres + redis). **Prerequisite:** `openapi.yaml` and
`asyncapi.yaml` exist in `../contract/` (derived from the markdown contract). No feature code.

### Stage 1 — Schema  →  Gate **G1**
From `@erd`: the Prisma models for this feature's entities + a migration. Includes the
**constraints** that carry business meaning (e.g. `Account` uniques, `Member @@unique`,
`Relation @@unique`, `Conversation.dmKey @@unique`). Verified by CRUD round-trips on a fresh DB.

### Stage 2 — Feature logic  →  Gate **G2**  *(headline: contract conformance)*
From `@contract` (+ `@events` for realtime-bearing features) and `@be-design`: controllers,
services, DTOs, guards, business logic. Contract conformance is the headline metric:
- **REST features:** every contract operation for the feature has a passing conformance test
  generated from `openapi.yaml`.
- **Realtime feature (and any feature that emits socket events):** event payloads conform to
  `asyncapi.yaml`, and the **persist-before-emit** ordering is asserted (no broadcast before
  the DB commit — NF-16).
- Security-sensitive features (Auth) additionally assert rate limiting (NF-11), password
  hashing (argon2, NF-09), and that message content / secrets never reach logs (NF-15).

### Stage 4 — Integration (JOINT)  →  Gate **G4**  *(shared with frontend)*
G4 cannot run from this side alone — the frontend drives it against the real running
stack (API + socket gateway + Postgres + Redis). The backend's job is to be **up and passing
G2** so the frontend can converge against it. G4 is recorded in BOTH trackers; the feature is
complete only when it is green on both sides.

---

## Definition of Done (backend portion)
```bash
npm run gate:be-feature   # = gate:scaffold && gate:schema && gate:backend
```
Backend-complete ≠ feature-complete. Feature-complete requires the joint **G4** too
(BE Done **and** FE Done **and** G4 green).
