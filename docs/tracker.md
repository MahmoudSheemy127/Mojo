# Implementation Timeline

> A manually-maintained, stage-by-stage build tracker. Each stage lists its items,
> the cross-stage dependencies (`→ Stage N`), and a **Deliverable** that defines done.
> "Done" for any feature = its gate exits 0 and the tracker (`BE-TRACKER.md` /
> `FE-TRACKER.md`) shows it green. Backend builds slightly ahead so the joint **G4**
> has a real API to converge against.
>
> Legend: `[ ]` todo · `[x]` done · `→ Stage N` depends on / deferred to · **(XC)** cross-cutting

---

## Stage 1 — Scaffolding & Skeleton Walkthrough

**Contract (prerequisite for everything):**
- [x] Freeze REST contract → `contract/openapi.yaml` (per-domain + bundle)
- [ ] Freeze socket contract → `contract/asyncapi.yaml`
- [x] Generate FE typed client from `openapi.yaml` (`api.generated.ts`) — drift = type error

**Backend scaffolding (Setup):**
- [x] NestJS project structure + module boilerplate (Express adapter — Socket.io needs it)
- [x] Prisma schema + first migration; Postgres + Redis via docker-compose
- [x] **(XC)** Global auth guard + `@Public()` decorator
- [x] **(XC)** Error-envelope exception filter (`{ error: { code, message } }`) + Prisma error mapping
- [x] **(XC)** Rate limiting (Throttler + Redis store, NF-11)
- [x] Observability & ops: structured logging (pino + correlation id, NF-20), `/health`, Sentry
- [ ] Config + env validation (fail fast on missing var)

**Frontend scaffolding (Setup):**
- [x] Vite + React + TS (strict) structure + providers shell (Query, Router, socket)
- [x] Tailwind theme tokens (Discord-like), design-system atoms (`components/ui`)
- [x] Observability: Sentry client

**Shared:**
- [x] Version control + branch strategy
- [ ] CI/CD backend (typecheck, lint, test, build; gate scripts wired)
- [ ] CI/CD frontend (typecheck, lint, test, build; `contract:types` step)
- [ ] **Integration check** — minimal `/ping` controller + Eden/Axios call proving FE↔BE type-safe link

> **Deliverable:** Repo boots; a minimal endpoint round-trips FE↔BE with full type safety;
> CI green on both sides; **G0** passes on backend and frontend.

---

## Stage 2 — Auth  ·  FR-01–04

- [x] Signup
- [x] Login
- [x] Refresh (rotating refresh token, httpOnly cookie)
- [ ] Sign out (revoke refresh token, NF-03)
- [ ] Password reset — request link
- [ ] Password reset — confirm (single-use token, revoke sessions)
- [ ] Google provider login (OAuth + account linking)
- [ ] **(XC)** Token service: issue / rotate / revoke; hashes stored, never raw
- [ ] **(XC)** Password hashing (argon2, NF-09); never log secrets (NF-15)
- [ ] FE: login/signup page, forgot-password flow, OAuth button, auth store + socket connect on success

> **Deliverable:** Users sign up, log in (credentials + Google), refresh, reset password,
> and log out. Auth guard protects every downstream route. **G1–G3** green for Auth.

---

## Stage 3 — Users  ·  FR-05, FR-10, FR-11

- [x] Fetch own profile (`GET /users/me`)
- [x] Update profile (display name, bio)
- [x] **Avatar upload** (`PUT /users/me/avatar`) + remove
- [x] Update presence status:
- [x] Persistence layer (`PATCH /users/me/presence`)
- [x] Socket broadcast `presence:changed` → Stage 5 (needs socket layer)
- [x] Search users (block-filtered, paginated)
- [x] Visit a user's public profile

> **Deliverable:** Profile view/edit incl. avatar; user search excludes blocked users;
> presence persists (live broadcast lands in Stage 5).

---

## Stage 4 — Contacts  ·  FR-06–09

- [ ] **(XC)** `canInteract(a, b)` block guard — reused by Stage 5 send & Stage 6 invites
- [x] List friends (with presence)
- [ ] Send friend request → notification (Stage 7); auto-accept on mutual request
- [x] List friend requests (incoming / outgoing)
- [ ] Accept friend request → notification + `conversation:new` (Stage 7 / Stage 5)
- [x] Decline friend request
- [x] Remove contact (symmetric)
- [x] Block user (drops friendship/requests, NF-13)
- [x] Unblock user
- [x] List blocked users (→ Settings)

> **Deliverable:** Full contact graph; block guard centralized and enforced everywhere it
> must be (search, DM, invite).

---

## Stage 5 — Conversations, Chat & Realtime  ·  FR-12–17

**Conversations:**
- [x] List conversations (sorted by recent):
  - [x] 1-on-1 DMs
  - [ ] Group conversations → Stage 6
- [x] Open a chat / open-or-create DM (idempotent, `dmKey`)
- [ ] Set conversation read (persist marker) + emit `message:status` read
- [x] Fetch message history (keyset on `(conversationId, id)`, backward pagination)

**Realtime foundation:**
- [x] Socket client init (JWT handshake auth, room join on connect)
- [x] Redis Socket.io adapter (cross-instance fan-out, NF-05)
- [x] **(XC)** Persist-**before**-broadcast ordering (NF-16) — emit only after DB commit
- [x] Reconnect + missed-message replay by ULID cursor (reliability NFR)
- [ ] Connection status banner (FE)

**Messaging:**
- [x] Send message:
  - [x] Persistence (assign ULID, update conversation last-message/activity)
  - [x] Socket `message:new` to other participants
  - [ ] Mentions → notification (Stage 7)
- [x] Upload attachments with message (P3; two-step upload-then-send)
- [ ] Typing status (socket relay, throttled)
- [ ] Message read (socket + persistence — both paths)
- [x] Message deleted (soft-delete persistence + `message:deleted` socket)
- [ ] FE optimistic send (`clientNonce`) + rollback on failure

> **Deliverable:** Login → open DM → send → recipient receives live → reload reads history
> from DB. **First joint-G4 milestone** (the vertical slice). Persist-before-broadcast and
> reconnect-replay verified.

---

## Stage 6 — Groups  ·  FR-18–23

- [ ] **Decision:** last-admin rule (block leave vs auto-promote) — settle before building
- [ ] **Decision:** join model (direct add vs admin-approved) — settle before building
- [x] Create group (creator = admin)
- [x] Get group detail + list members
- [x] Update group profile (name/description/avatar) → notification (Stage 7)
- [ ] Delete group
- [x] Add / invite members (block-guarded) → notification (Stage 7)
- [ ] Change member role (promote / demote; last-admin guard) → notification (Stage 7)
- [x] Remove member → notification (Stage 7)
- [ ] Leave group (self) — same endpoint as remove, branches on target
- [x] Generate invite link (token, expiry, max-uses)
- [x] Join via link (direct or pending per model)
- [ ] Group join-request approval by admin → notification (Stage 7)
- [ ] Backfill: group conversations into Stage 5's conversation list

> **Deliverable:** Groups create/join/leave; admins manage members, roles, invites; both
> deferred business decisions documented and implemented.

---

## Stage 7 — Notifications  ·  FR-30

- [ ] Define notification types + payload shape (friend/group/mention/system)
- [ ] **(XC)** `notifications.service` — created as a side effect of Stage 4 & 6 actions
- [ ] List notifications (feed; messages stay as unread badges, not feed rows)
- [ ] Unread count (drives bell badge)
- [ ] Mark notifications seen (seen ≠ resolved)
- [ ] Socket `notification:new` to the target on creation
- [ ] Backfill: wire every `→ Stage 7` callsite from Stages 4–6 to emit real notifications

> **Deliverable:** Notification feed + badge live; every deferred "create notification" hook
> from earlier stages now fires.

---

## Stage 8 — Polish, Hardening & Launch

- [ ] **(XC)** GDPR account deletion (`DELETE /users/me`) — anonymize messages, purge account/tokens (privacy NFR)
- [ ] Error boundaries on all routes; route-level error fallbacks
- [ ] Loading skeletons on all data-fetching routes
- [ ] Empty states (no contacts, no conversations, no notifications, etc.)
- [ ] Mobile-responsive audit (down to 320px, usability NFR)
- [ ] Accessibility pass (focus traps, labels, keyboard nav)
- [ ] Performance: message-history query (raw SQL if Prisma underperforms); coverage ≥70% (NF-19)
- [ ] **Joint-G4 convergence pass** — run every feature's e2e against the real stack; flip both trackers green
- [ ] Deploy config (env, domain, TLS/WSS); soft launch to beta; monitor Sentry

> **Deliverable:** All features feature-complete (FE Done + BE Done + **G4** green), hardened,
> responsive, and deployed to beta.

---

## Cross-cutting threads (don't live in one stage)

| Thread | Introduced | Completed |
|---|---|---|
| Block guard `canInteract()` | Stage 4 | enforced through Stage 6 |
| Persist-before-broadcast (NF-16) | Stage 5 | every emit thereafter |
| Reconnect / missed-message replay | Stage 5 | verified at Stage 8 G4 |
| Notification side-effects | Stages 4–6 (deferred) | wired in Stage 7 |
| Joint G4 per feature | each stage | converged in Stage 8 |
| Two group decisions (last-admin, join model) | flagged since Phase 3 | settled in Stage 6 |


## Notes vs the original draft
- Added the **contract derivation** + **schema/migration** + **observability** to Stage 1
  (they're prerequisites, not optional).
- Pulled the **auth cross-cutting foundation** (guard, error filter, rate limit) into Stage 2.
- Added **avatar upload** to Stage 3.
- Named the **block guard** explicitly in Stage 4 (Stages 5–6 depend on it).
- Called out **persist-before-broadcast** and **reconnect replay** as explicit Stage 5 items.
- Forced the **two group decisions** to the top of Stage 6.
- Turned "code optimization" into a real **Stage 8** with hardening, GDPR deletion, and the
  joint-G4 convergence pass.
- Added a **Deliverable** line per stage and a **gate exit** as the definition of done.
