# Backend — QA Strategy & Gates

> Gates for the backend session only (**G0, G1, G2**) plus the **JOINT G4**.
> Each gate is a runnable command. The gate script writes its result into `BE-TRACKER.md`
> as its final step — the tracker is an OUTPUT of the gate, never narrated by the agent.
> Tooling is **Jest** (NestJS default). DB + Redis for schema/integration/realtime gates are
> provided by `docker-compose.yml` (postgres:16, redis:7) or Testcontainers.

## Gate scripts (package.json)
```jsonc
{
  "typecheck":        "tsc --noEmit",
  "lint":             "eslint .",
  "build":            "nest build",
  "test:schema":      "jest --selectProjects schema",
  "test:contract":    "jest --selectProjects contract",
  "test:unit":        "jest --selectProjects unit",
  "test:integration": "jest --selectProjects integration",
  "test:realtime":    "jest --selectProjects realtime",
  "test:cov":         "jest --coverage",            // threshold ≥70% in jest.config

  "gate:scaffold":  "npm ci && npm run build && npm run typecheck && npm run lint && node scripts/check-structure.mjs && node scripts/check-contract-specs.mjs",
  "gate:schema":    "prisma migrate reset --force && prisma generate && npm run test:schema",
  "gate:backend":   "npm run typecheck && npm run lint && npm run test:contract && npm run test:realtime && npm run test:unit && npm run test:integration && npm run test:cov && npm audit --audit-level=high",
  "gate:be-feature":"npm run gate:scaffold && npm run gate:schema && npm run gate:backend"
}
```

---

## Gate G0 — Scaffold conformance  *(project-level, runs once)*
```bash
npm run gate:scaffold
```
**Checks:** `npm ci` → `build` → `typecheck` → `lint` → `check-structure.mjs` (folders/files
vs `@be-design`) → `check-contract-specs.mjs` (`../contract/openapi.yaml` and
`../contract/asyncapi.yaml` exist and parse).
**Target:** all exit 0; structure check reports **0 missing items** vs `@be-design`; both
contract specs present and valid. Without the specs, G2 cannot run.

## Gate G1 — Schema conformance
```bash
npm run gate:schema
```
**Checks:** `prisma migrate reset --force` (migrations apply clean on a fresh DB) →
`prisma generate` → `test:schema`.
**Targets:**
- Migration applies clean; client generates.
- CRUD round-trip passes per entity vs `@erd`.
- **Constraints enforced** (these are business rules, not cosmetics): one DM per pair
  (`Conversation.dmKey` unique), one membership per user+group (`Member` unique), one relation
  per `(owner, related, type)` (`Relation` unique), account uniques (username/email),
  `Notification.requestId` unique (0..1 to `Request`). A test that violates each must fail.

## Gate G2 — Feature logic  *(headline: contract conformance)*
```bash
npm run gate:backend
```
**Checks & targets:**
- `typecheck` + `lint` → **0 errors**.
- `test:contract` — generated/validated FROM `@contract` (`openapi.yaml`), hitting the running
  API; **100% of the feature's REST operations** have a passing conformance test (status codes,
  response shapes, error envelope `{ error: { code, message } }`). Independent of internal impl.
- `test:realtime` — for the **Realtime** feature and any feature that emits socket events:
  - emitted/received payloads conform to `@events` (`asyncapi.yaml`);
  - **persist-before-emit** is asserted — no `message:new` (or other broadcast) is observable
    before the row is committed (NF-16);
  - socket handshake rejects an invalid/expired JWT;
  - reconnect replays missed messages by ULID cursor with no loss/dupes.
- `test:unit` + `test:integration` — business rules meet acceptance criteria
  (block guard rejects; last-admin rule; mention → notification; idempotent open-DM).
- `test:cov` — backend coverage **≥70%** (NF-19); gate fails below threshold.
- `npm audit --audit-level=high` — **0 high-sev** vulns.
- **Security assertions** (Auth and any sensitive feature): rate limit ≤10 req/min/IP on auth
  endpoints (NF-11); passwords hashed with argon2 (NF-09); JWT access TTL ≤15 min; **no message
  content or secrets in logs** (NF-15) — asserted by a log-capture test.

## Gate G4 — Integration  *(JOINT — shared with frontend)*
Runs at convergence, **driven from the frontend** against the real running
**backend + socket gateway + Postgres + Redis** (never a mock).
- **Backend prerequisite:** G2 green, the API boots, and the Socket.io gateway accepts
  authenticated connections.
- **Recorded in both trackers.** The feature is complete only when G4 is green on both sides.

---

## Backend definition of done
```bash
npm run gate:be-feature   # = gate:scaffold && gate:schema && gate:backend
```
Backend-complete is necessary but **NOT sufficient** for feature-complete (needs joint G4).

## Notes on the gates
- **Contract tests are impl-independent.** They are generated from `openapi.yaml` /
  `asyncapi.yaml`, so they catch backend drift regardless of how handlers are written. Do not
  hand-write them to match the implementation.
- **Realtime is first-class.** Because the socket layer carries core behavior (live delivery,
  persist-then-broadcast, reconnect replay), its conformance lives inside G2 rather than being
  deferred to G4 — G4 only confirms the two sides agree end-to-end.
- **The tracker is an artifact, not prose.** Each gate writes PASS/FAIL + timestamp + commit
  into `BE-TRACKER.md` as its final step.