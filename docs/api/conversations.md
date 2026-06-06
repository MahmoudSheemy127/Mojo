# Conversations — API Contract

Covers the chat-session list that powers the left column, and opening/creating a
1-on-1 DM. Message content lives in `messages.md`; group management in `groups.md`.
Shared types in `README.md`.

> A "conversation" is the unifying concept over DMs and groups. Both expose the same
> message endpoints (`messages.md`). The discriminated `Conversation` union
> (`DmConversation` | `GroupConversation`) is defined in `README.md`.

---

## List conversations (chat sessions)

Flow: `[FE] —(access token, cursor?)→ [BE] —(load conversations w/ last message + unread, sorted by recent)→ (Paginated<Conversation>)→ [FE]`

`GET /conversations?cursor=&limit=` · **Authenticated**

Response `200`: `Paginated<Conversation>`, **sorted by `lastActivityAt` descending**
(most recent first — drives the Chats tab ordering).

Each item includes `lastMessage`, `lastActivityAt`, and `unreadCount`. DMs include
`otherUser`; groups include `name`, `avatarUrl`, `memberCount`, and the caller's `role`.

> FE: query key `['conversations']`. Live-updated by `message:new` (bump + preview +
> unread) and `conversation:new` (new DM/group appears) — see `realtime.md`.

---

## Get a single conversation

Flow: `[FE] —(conversationId)→ [BE] —(authorize membership, load metadata)→ (Conversation)→ [FE]`

`GET /conversations/:conversationId` · **Authenticated**

Response `200`: a `Conversation`.

Authorization: the caller must be a participant (DM) or member (group), enforced
server-side (NF-13). Non-members → `403 FORBIDDEN` (or `404` to avoid leaking
existence — default `404`).

Errors: `404 NOT_FOUND`.

> FE: used to restore header context on deep-link to `/c/:conversationId`.
> Query key `['conversations', conversationId]`.

---

## Open or create a DM

Flow: `[FE] —(userId)→ [BE] —(find existing DM or create one; must be contacts & not blocked)→ (DmConversation)→ [FE]`

`POST /conversations/dm` · **Authenticated** · FR-12

Request body:
```typescript
{ userId: string; }   // the contact to DM
```

Response:
- `200` with the existing `DmConversation` if one already exists, **or**
- `201` with a newly created `DmConversation`.

Behavior:
- Idempotent: calling repeatedly with the same user returns the same conversation.
- The two users must be contacts (decide policy: contacts-only vs anyone-not-blocked).
  Default: must be friends (FR-12 says "with a contact").
- Blocked in either direction → `403 BLOCKED`.

Errors: `404 NOT_FOUND` (no such user), `403 BLOCKED`, `403 FORBIDDEN` (not a contact).

Realtime: emits `conversation:new` to the other user so the DM appears in their list.

---

## Mark a conversation read

Flow: `[FE] —(conversationId, lastReadMessageId)→ [BE] —(advance read marker, notify senders)→ (204)→ [FE]` + `[BE] —(message:status read)→ [senders]`

`POST /conversations/:conversationId/read` · **Authenticated** · FR-14

Request body:
```typescript
{ lastReadMessageId: string; }
```

Response `204`. Advances the caller's read marker; clears their `unreadCount` for this
conversation.

Realtime: emits `message:status { messageId, status: 'read', userId }` to the
message senders so their UI shows "Read".

> This REST endpoint is the durable path. A `message:read` socket event (see
> `realtime.md`) does the same thing for low-latency updates while connected; the FE
> may use either, but the REST call guarantees the read marker survives reconnects.

---

## Implementation notes

- **BE**: `conversations.controller.ts`. The list query is the hot path — it joins each
  conversation to its latest message and computes `unreadCount` from the caller's read
  marker. Plan to optimize this with a denormalized `last_message_id` /
  `last_activity_at` on the conversation row, and a per-member read cursor. Drop to raw
  SQL here if Prisma's generated query is slow (matches the FE/architecture note).
- **FE**: `features/contacts/api.ts` → `fetchConversations`; `features/chat/api.ts` →
  `getConversation`, `openDm`, `markRead`. Selecting a row sets `uiStore.activeConversationId`
  and navigates to `/c/:conversationId`.
