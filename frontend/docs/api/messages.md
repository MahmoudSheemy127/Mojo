# Messages — API Contract

Covers message history, sending, soft-deleting, and attachments. Realtime delivery,
typing, and read receipts are in `realtime.md`. Shared types in `README.md`.

> Persistence-before-ack (NF-16): a message is committed to PostgreSQL **before** the
> `201` is returned to the sender. The HTTP `201` *is* the durable ack. Recipients are
> notified separately via the `message:new` socket event.

All message endpoints require the caller to be a participant/member of the
conversation (server-enforced, NF-13).

---

## Fetch message history

Flow: `[FE] —(conversationId, cursor?, limit?)→ [BE] —(authorize, load page going backward in time)→ (Paginated<Message>)→ [FE]`

`GET /conversations/:conversationId/messages?cursor=&limit=` · **Authenticated** · FR-13

Query params:
- `cursor` — opaque cursor; omit for the newest page. Paginates **backward** (older
  messages) on scroll-up.
- `limit` — default 30, server-capped.

Response `200`: `Paginated<Message>`.
- `data` is ordered **oldest → newest** within the page.
- `nextCursor` points to the next *older* page; `null` at the start of history.
- Soft-deleted messages are included with `content: null` and `deletedAt` set, so the
  FE can render the "deleted" placeholder in place (FR-16).

Errors: `403 FORBIDDEN` / `404 NOT_FOUND` (not a member).

> FE: query key `['messages', conversationId]`; infinite query paginating on `nextCursor`.

---

## Send a message

Flow: `[FE] —(content, attachmentIds?, clientNonce)→ [BE] —(authorize, persist, assign sequence, ack)→ (Message)→ [FE]` + `[BE] —(message:new)→ [other participants]`

`POST /conversations/:conversationId/messages` · **Authenticated** · FR-13

Request body:
```typescript
{
  content: string | null;     // text; may be null if attachments present
  attachmentIds?: string[];   // ids from POST /attachments (FR-17, P3)
  clientNonce?: string;        // FE-generated id to reconcile the optimistic bubble
}
```
At least one of `content` (non-empty) or `attachmentIds` must be present.

Response `201`: the persisted `Message` (includes server `id`, `sequence`, `createdAt`,
`status: 'sent'`, and `clientNonce` echoed back for reconciliation).

Behavior:
- Server assigns the monotonic per-conversation `sequence` used for reconnect replay.
- `@mentions` in `content` generate `mention` notifications to mentioned members
  (FR-30) and emit `notification:new`.
- Blocked DM → `403 BLOCKED`.

Errors: `403 BLOCKED`, `403 FORBIDDEN`/`404 NOT_FOUND`, `422 VALIDATION_ERROR`
(empty message), `413` (attachment too large at upload time — see below).

Realtime: emits `message:new { message }` to all other participants; bumps the
conversation in everyone's list.

> FE: optimistic mutation in `features/chat/hooks/useSendMessage.ts` — render a bubble
> with `status:'sending'` keyed by `clientNonce`, then replace with the `201` body
> (status `sent`). Roll back on error.

---

## Delete a message (soft)

Flow: `[FE] —(messageId)→ [BE] —(authorize ownership, soft-delete)→ (204)→ [FE]` + `[BE] —(message:deleted)→ [participants]`

`DELETE /messages/:messageId` · **Authenticated** · FR-16

Response `204`. Sets `deletedAt` and nulls `content`/attachments; the row remains so
the placeholder renders for everyone.

Authorization: only the message's **sender** may delete it (group admins removing
others' messages is **not** in scope — no FR; flag if wanted).

Errors: `403 FORBIDDEN` (not the sender), `404 NOT_FOUND`.

Realtime: emits `message:deleted { conversationId, messageId }` to participants.

---

## Upload an attachment (P3)

Flow: `[FE] —(multipart file)→ [BE] —(validate type/size, store in object storage)→ (Attachment)→ [FE]` then the returned id is passed to send-message.

`POST /attachments` · **Authenticated** · FR-17 · **P3**

Request: `multipart/form-data` with field `file`. Server enforces a configurable max
size and allowed types.

Response `201`: `Attachment` (id + url + metadata). The id is then referenced in
`attachmentIds` when sending the message.

Errors: `413 FILE_TOO_LARGE`, `422 VALIDATION_ERROR` (disallowed type).

> Two-step (upload then send) keeps message send fast and lets the FE show upload
> progress before the message exists. Requires object storage (S3/R2) — a P3
> dependency; until then this endpoint may be stubbed/disabled.

---

## Implementation notes

- **BE**: `messages.controller.ts`. Sequence assignment must be atomic per conversation
  (DB sequence or `SELECT … FOR UPDATE` / monotonic counter). Persist, then emit the
  socket event (never emit before commit). History pagination uses a keyset on
  `(conversation_id, sequence)` for stable cursors. This is the hot read path — drop
  to raw SQL if needed.
- **FE**: `features/chat/api.ts` → `fetchMessages`, `sendMessage`, `deleteMessage`,
  `uploadAttachment`. Incoming `message:new` events append to the
  `['messages', conversationId]` cache; `message:deleted` patches the message;
  `message:status` updates per-message status.
