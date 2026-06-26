# BE-TRACKER

Gate results per feature (docs/qa/qa.md). PASS/FAIL + timestamp + commit.

## groups

| Gate | Result | When | Commit | Notes |
|------|--------|------|--------|-------|
| G1 — schema (`gate:schema`) | PASS | 2026-06-23 | d582d8c (working tree) | migrate reset clean on fresh DB; client generates; `test/schema-groups.spec.ts` enforces Group.conversationId / Member(userId,groupId) / GroupInviteLink.token uniques. |
| G2 — backend (`gate:backend`) | PASS* | 2026-06-23 | d582d8c (working tree) | typecheck + lint clean; contract 7 suites / 59 tests (incl. `contract-groups`); realtime 3/3; unit 141; coverage 92.92% lines (≥70%). *Pre-existing caveats only: `npm audit` 11 high in transitive build deps (no deps added by this feature) and a cosmetic Jest open-handle linger — see memory `g2-gate-caveats.md`. |

## notifications

| Gate | Result | When | Commit | Notes |
|------|--------|------|--------|-------|
| G1 — schema (`gate:schema`) | PASS | 2026-06-24 | working tree | migrate reset clean on fresh DB (user-consented); client generates; schema 3 suites / 11 tests — `test/schema-notifications.spec.ts` covers the Notification round-trip (read default false, payload + actor persist, null actor for system) and enforces `Notification.requestId @unique` (0..1 to Request, note 5). No new schema/migration needed — the `Notification` model + `NotificationType` enum were already in the initial migration. |

Design decisions (per notifications.openapi.yaml + notifications.md):
- Feed is read-only here: `GET /notifications` (keyset, newest first), `GET /notifications/count`
  (unseen), `POST /notifications/seen` (clear badge). Actions on actionable items stay in
  contacts/groups; seen ≠ resolved.
- `read` is the "seen" flag: count = `read:false`; markSeen sets `read:true`, scoped to the
  caller (and to `ids` when given). Message notifications are intentionally NOT feed rows
  (per-conversation unread badges instead).
- Creation is a side effect of other domains: `NotificationsService.create()` persists then
  emits `notification.created`; the realtime listener fans `notification:new` to the
  recipient's `user:<id>` room (persist-then-broadcast, NF-16).

Design decisions (per groups.openapi.yaml + groups.md "Phase 4 / FLAG #3"):
- Direct-join model: invite links join directly (201) / idempotent (200) / 400 INVITE_INVALID;
  the conditional join-request accept/decline endpoints are intentionally omitted.
- Last-admin rule: hard 409 LAST_ADMIN on demote/remove/leave while other members remain;
  the sole remaining admin leaving dissolves the group.
- A group IS a conversation: `Group.id == Conversation.id`, so one id flows through
  groups, conversations, and messages.
