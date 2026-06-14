# Notifications — API Contract

Covers the notification feed and unread count. The **actions** on actionable
notifications (accept/decline friend requests, group invites, join requests) live in
`contacts.md` and `groups.md`; this file covers reading the feed and clearing the
badge. Shared types in `README.md`.

> The `Notification.payload` carries the ids (`requestId`, `inviteId`, `groupId`,
> `conversationId`, `messageId`) the FE needs to dispatch to the correct action
> endpoint. See the `Notification` type and `NotificationType` enum in `README.md`.

---

## List notifications

Flow: `[FE] —(cursor?, limit?)→ [BE] —(load feed, newest first)→ (Paginated<Notification>)→ [FE]`

`GET /notifications?cursor=&limit=` · **Authenticated** · FR-30

Response `200`: `Paginated<Notification>`, newest first.

Notification types (see `README.md`):
- `friend_request` — actionable → `contacts.md` accept/decline (uses `payload.requestId`).
- `friend_request_accepted` — informational.
- `group_invite` — actionable → `groups.md` (uses `payload.inviteId` / `groupId`).
- `group_join_request` — actionable, **admins only** → `groups.md` join-request
  accept/decline (uses `payload.requestId` / `groupId`). Conditional on the approval
  model (FLAG #3).
- `mention` — informational; clicking navigates to `payload.conversationId` /
  `payload.messageId`.
- `missed_call` — only if voice is in scope (FLAG #1).
- `generic` — informational; renders `payload.text`.

> FE: query key `['notifications']`; live-prepended by `notification:new`
> (see `realtime.md`).
>
> Policy: **message** notifications are represented by per-conversation unread badges
> (from `GET /conversations`), **not** as feed rows, to avoid noise. This feed is for
> invites, requests, mentions, and system events.

---

## Unread count

Flow: `[FE] —(access token)→ [BE] —(count unseen)→ (count)→ [FE]`

`GET /notifications/count` · **Authenticated** · FR-30

Response `200`:
```typescript
{ count: number; }   // unseen notifications; drives the header bell badge
```

> FE: query key `['notifications', 'count']`; incremented live by `notification:new`,
> reset by the mark-seen call.

---

## Mark notifications seen

Flow: `[FE] —(open the dropdown)→ [BE] —(mark all unseen as seen)→ (204)→ [FE]`

`POST /notifications/seen` · **Authenticated** · FR-30

Request: no body (marks all unseen as seen) — or optionally:
```typescript
{ ids?: string[]; }   // mark specific notifications seen; omit = all
```

Response `204`. Clears the bell badge. **Seen ≠ resolved**: actionable items
(friend/group/join requests) remain actionable until accepted/declined via their
domain endpoints.

> FE: called when the notification dropdown opens. Invalidate
> `['notifications', 'count']` (→ 0) but keep `['notifications']` rows so pending
> actions are still shown.

---

## Implementation notes

- **BE**: `notifications.controller.ts`. Notifications are **created as side effects**
  of other actions (friend request → `friend_request`; mention in a sent message →
  `mention`; group invite → `group_invite`), each paired with a `notification:new`
  socket emit. Keep creation in a small `notifications.service.ts` invoked from the
  relevant controllers, not duplicated.
- **FE**: `features/notifications/api.ts` → `fetchNotifications`, `fetchCount`,
  `markSeen`. The accept/decline handlers call `features/contacts/api.ts` or
  `features/groups/api.ts` based on `notification.type`, then optimistically remove or
  resolve the row.
