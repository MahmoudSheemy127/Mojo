# Realtime — Socket.io Event Contract

The WebSocket protocol over Socket.io. This is the realtime half of the contract;
durable operations (send, delete, read marker, presence set) also have REST endpoints
in the other files. Shared types in `README.md`.

> Division of labor: **REST** handles durable writes and reads (persist-before-ack,
> NF-16); **Socket.io** handles low-latency delivery and ephemeral signals (typing,
> presence, live status, notifications). The FE socket-event → handler mapping mirrors
> the table in the Frontend Design Document.

---

## Connection & authentication

```
[FE] —(connect with access token)→ [BE] —(verify JWT, join rooms)→ (connected)→ [FE]
```

Client connects with the access token in the handshake:
```typescript
import { io } from 'socket.io-client';
const socket = io(VITE_SOCKET_URL, {
  auth: { token: accessToken },     // verified server-side on connection
  withCredentials: true,
  transports: ['websocket'],
});
```

- The server verifies the JWT on connect. Invalid/expired → connection rejected with
  error `UNAUTHENTICATED`; the FE refreshes the access token (`POST /auth/refresh`)
  and reconnects.
- On successful connect the server **joins the socket to a room per conversation** the
  user belongs to (DMs + groups), plus a personal room (`user:<id>`) for
  notifications and presence fan-out.
- Connecting flips the user to `online` and emits `presence:changed` to their contacts;
  disconnecting (after a short grace period) flips them to `offline`.

### Connection lifecycle events (built-in)
| Event | Direction | Meaning |
|---|---|---|
| `connect` | s→c | Socket established. FE sets `socketStore.status = 'connected'`. |
| `disconnect` | s→c | Dropped. FE sets `'disconnected'`; shows the reconnect banner. |
| `connect_error` | s→c | Auth or transport error. FE may refresh token + retry. |

---

## Client → Server events 

> These are ephemeral signals. They take an optional ack callback where noted.

### `typing:start` / `typing:stop` — FR-15
```typescript
socket.emit('typing:start', { conversationId: string });
socket.emit('typing:stop',  { conversationId: string });
```
The server relays to the other participants of that conversation (never echoes to the
sender). The FE throttles `typing:start` and sends `typing:stop` on idle/blur/send.

### `message:read` — FR-14
```typescript
socket.emit('message:read', { conversationId: string, lastReadMessageId: string });
```
Low-latency read marker while connected. The server advances the read marker and emits
`message:status` (read) to the message senders. Equivalent to
`POST /conversations/:id/read`; the REST call is the durable fallback for reconnects.

> Message **send** is intentionally **not** a socket event — it goes through
> `POST /conversations/:id/messages` (persist-before-ack, NF-16). The server then
> broadcasts `message:new` to recipients.

---

## Server → Client events

All payloads use the shared entity types from `README.md`.

### Messaging
| Event | Payload | Trigger | FE handler |
|---|---|---|---|
| `message:new` | `{ message: Message }` | Another participant sent a message (via REST) | `chat/useMessages` — append to `['messages', conversationId]`; bump `['conversations']`; increment unread if not active |
| `message:deleted` | `{ conversationId: string, messageId: string }` | Sender soft-deleted (FR-16) | `chat/useMessages` — patch message to deleted placeholder |
| `message:status` | `{ conversationId: string, messageId: string, status: 'delivered' \| 'read', userId: string }` | Recipient received/read a message (FR-14) | `chat/useReadReceipts` — update that message's status |

### Typing
| Event | Payload | Trigger | FE handler |
  |---|---|---|---|
| `typing:start` | `{ conversationId: string, userId: string }` | Another user is typing (FR-15) | `chat/useTyping` — show indicator |
| `typing:stop` | `{ conversationId: string, userId: string }` | They stopped | `chat/useTyping` — hide indicator |

### Presence — FR-10
| Event | Payload | Trigger | FE handler |
|---|---|---|---|
| `presence:changed` | `{ userId: string, status: Presence }` | A contact connected/disconnected or set status | `presence/usePresenceFeed` — update that user in `['contacts','friends']` and any open DM header |

### Notifications — FR-30
| Event | Payload | Trigger | FE handler |
|---|---|---|---|
| `notification:new` | `{ notification: Notification }` | A new notification was created for the user | `notifications/useNotifications` — prepend to `['notifications']`; increment `['notifications','count']` |

### Conversations & groups
| Event | Payload | Trigger | FE handler |
|---|---|---|---|
| `conversation:new` | `{ conversation: Conversation }` | A new DM/group became available (DM accepted, added to group) | `contacts/useConversations` — add to `['conversations']`; join its room |
| `group:updated` | `{ group: Group }` | Group profile changed (FR-23) | `groups/useGroupSettings` — invalidate `['groups', id]`; refresh list entry |
| `group:deleted` | `{ groupId: string }` | Group deleted | close that chat window → empty state; remove from `['conversations']` |
| `member:added` | `{ groupId: string, member: GroupMember }` | A member joined/was added (FR-19) | invalidate `['groups', groupId, 'members']` |
| `member:removed` | `{ groupId: string, userId: string }` | A member left/was removed (FR-21/22) | if self → close chat + toast; else invalidate members |
| `member:role_changed` | `{ groupId: string, userId: string, role: GroupRole }` | Promote/demote (FR-20) | invalidate members; if self → toggle admin UI |

> **Naming note:** group membership events use the `member:*` family (matching the
> Frontend Design Document). If you prefer a single namespace, rename to `group:member_*`
> consistently across FE and BE — but pick one before implementation.

---

## Reconnection & missed-message replay (reliability NFR)

```
[FE] —(reconnect + lastSequence per active conversation)→ [BE] —(replay messages after cursor)→ (missed message:new events)→ [FE]
```

- The FE tracks the highest `Message.sequence` it has seen per conversation.
- On reconnect, the FE (a) refetches `['notifications','count']` and the active
  conversation's recent page via REST, and (b) the server replays any `message:new`
  events with `sequence` greater than the client's last-seen cursor for rooms the
  socket rejoins.
- Because `sequence` is monotonic per conversation, the FE can de-duplicate replayed
  vs already-cached messages by `id`/`sequence`.

> Exact replay mechanism (server push on rejoin vs FE-driven `GET …/messages?cursor=`)
> is finalized in Phase 4. The contract guarantees: no message is lost across a
> reconnect, and `sequence` is the ordering/dedup key.

---

## Room model (server-side, informative)

| Room | Joined by | Receives |
|---|---|---|
| `conversation:<id>` | all participants/members | `message:*`, `typing:*` for that conversation |
| `user:<id>` | the user's own sockets | `presence:changed` (about contacts), `notification:new`, `conversation:new` |
| `group:<id>` | group members (≈ `conversation:<id>` for groups) | `group:*`, `member:*` |

This is implementation guidance for the BE (how to scope emits via the Redis adapter,
NF-05). It is not called by the FE directly.

---

## Implementation notes

- **BE**: a `socket/` module — `socket/index.ts` (auth middleware + room join on
  connect), and per-domain emitters (`socket/emitters.ts`) invoked by the REST
  controllers after a successful DB commit (e.g. messages controller emits
  `message:new` after persisting). Use the Socket.io **Redis adapter** so emits reach
  sockets on any instance (NF-05).
- **FE**: `lib/socket.ts` (instance), `hooks/useSocket.ts` (connect/disconnect with
  auth, status into `socketStore`), `hooks/useSocketEvent.ts` (typed subscribe/cleanup).
  Each feature hook subscribes only to the events it owns (per the table above).
- **Typed events**: define a `ServerToClientEvents` / `ClientToServerEvents` interface
  pair (in `types/socket.ts`, shared shape on both sides) so `socket.on`/`emit` are
  fully typed.
