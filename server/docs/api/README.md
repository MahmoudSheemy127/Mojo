# API Contract

> Phase 3 · The Contract. The frozen shared protocol between frontend and backend.
> Once agreed, neither side changes an endpoint shape without a contract revision.

This is the source of truth for:
- **Frontend**: the `api.ts` functions in each `features/<feature>/` module, the
  TanStack Query keys, and the Socket.io event handlers.
- **Backend**: the controller/route layer, request validation (Zod), and the
  Socket.io emit points.

## Files

| File | Domain | FRs |
|---|---|---|
| `auth.md` | Signup, login, logout, token refresh, password reset, Google OAuth | FR-01–04 |
| `users.md` | Profile, avatar, user search, presence | FR-05, FR-10, FR-11 |
| `contacts.md` | Friend requests, remove contact, block/unblock | FR-06–09 |
| `conversations.md` | Chat session list, open/create DM | FR-12 |
| `messages.md` | Message history, send, delete, read receipts, attachments | FR-13–17 |
| `groups.md` | Create/update/delete group, members, roles, invites, leave | FR-18–23 |
| `notifications.md` | Notification feed, counts, mark-seen | FR-30 |
| `realtime.md` | All Socket.io events (client↔server) | FR-13–15, FR-30 |

---

## Conventions

### Base URL
```
REST:   {VITE_API_URL}        e.g. https://app.example.com/api
Socket: {VITE_SOCKET_URL}     e.g. https://app.example.com   (same origin in prod)
```

### Flow notation
Each endpoint opens with a one-line flow so the intent is readable at a glance:
```
[FE] —(what is sent)→ [BE] —(what BE does)→ (what is returned)→ [FE]
```
This is documentation, not a wire format. The authoritative request/response shapes
are in the typed blocks below each flow.

### Authentication
- **Access token**: short-lived JWT (≤ 15 min, per NF-10). Sent on every authenticated
  request as `Authorization: Bearer <accessToken>`.
- **Refresh token**: rotating, sent/stored as an `httpOnly`, `Secure`, `SameSite=Strict`
  cookie. Never readable by JS. Used only by `POST /auth/refresh`.
- Endpoints are marked one of:
  - `Public` — no token required.
  - `Authenticated` — valid access token required.
  - `Admin` — authenticated **and** the caller must hold the required role for the
    target resource (e.g. group admin).
- Missing/expired token on an authenticated route → `401 UNAUTHENTICATED`.
  Authenticated but not allowed → `403 FORBIDDEN`.

### IDs and timestamps
- All `id` fields are **UUID v4 strings**.
- All timestamps are **ISO 8601 UTC strings** (e.g. `2026-06-06T12:00:00.000Z`).

### Success responses
- Single resource → the resource object directly.
- Collections → a paginated envelope:
  ```typescript
  interface Paginated<T> {
    data: T[];
    nextCursor: string | null;   // pass back as ?cursor= ; null = end of list
  }
  ```

### Pagination
Cursor-based everywhere. Request: `?cursor=<opaque>&limit=<n>` (server caps `limit`,
default 30). Message history paginates backward in time (older on scroll-up).

### Error envelope
Every non-2xx response uses:
```typescript
interface ApiError {
  error: {
    code: string;          // stable machine code (see table) — switch on this, not message
    message: string;       // human-readable, safe to surface or log
    details?: unknown;     // optional: field-level validation errors
  };
}
```

### Standard status codes
| Status | Meaning |
|---|---|
| 200 | OK (read / update) |
| 201 | Created |
| 202 | Accepted (async / intentionally non-committal, e.g. password reset request) |
| 204 | No Content (successful action, nothing to return) |
| 400 | Bad request (malformed) |
| 401 | Unauthenticated (no/invalid/expired token) |
| 403 | Forbidden (authenticated but not permitted) |
| 404 | Not found |
| 409 | Conflict (duplicate / state conflict) |
| 422 | Validation error (well-formed but semantically invalid) |
| 429 | Rate limited (auth endpoints capped per NF-11) |
| 500 | Server error |

### Common error codes
| Code | Typical status |
|---|---|
| `UNAUTHENTICATED` | 401 |
| `TOKEN_EXPIRED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `VALIDATION_ERROR` | 422 |
| `RATE_LIMITED` | 429 |
| `CONFLICT` | 409 |
| `BLOCKED` | 403 (action blocked by a block relationship) |
| `INTERNAL` | 500 |

---

## Shared entity types

These types are referenced by every domain file. Define them once (frontend
`types/entities.ts`; backend shared package or mirror).

```typescript
type Presence = 'online' | 'away' | 'dnd' | 'offline';

// Other users, as seen by the caller
interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presence: Presence;
}

// The authenticated user themselves (adds private fields)
interface SelfUser extends PublicUser {
  email: string;
  createdAt: string;
}

// Relationship of another user to the caller (used in search/contacts)
type Relationship =
  | 'none'
  | 'request_sent'       // caller sent a request, pending
  | 'request_received'   // other user sent caller a request, pending
  | 'friends'
  | 'blocked'            // caller blocked them
  | 'blocked_by';        // they blocked caller

interface Attachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'file';
}

type MessageStatus = 'sent' | 'delivered' | 'read';
// note: 'sending' is a client-only optimistic state, never sent by the server.

interface Message {
  id: string;
  conversationId: string;
  sequence: number;            // monotonically increasing per conversation; reconnect cursor
  senderId: string;
  content: string | null;      // null when deleted
  attachments: Attachment[];
  status: MessageStatus;       // for the caller's own sent messages
  createdAt: string;
  deletedAt: string | null;    // set when soft-deleted (FR-16)
}

type ConversationType = 'dm' | 'group';

interface ConversationBase {
  id: string;
  type: ConversationType;
  lastMessage: Message | null;
  lastActivityAt: string;
  unreadCount: number;
}

interface DmConversation extends ConversationBase {
  type: 'dm';
  otherUser: PublicUser;       // the contact on the other side
}

interface GroupConversation extends ConversationBase {
  type: 'group';
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  role: GroupRole;             // caller's role in the group
}

type Conversation = DmConversation | GroupConversation;

type GroupRole = 'admin' | 'member';

interface GroupMember {
  user: PublicUser;
  role: GroupRole;
  joinedAt: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  memberCount: number;
  role: GroupRole;             // caller's role
  members?: GroupMember[];     // included on the detail endpoint only
}

type NotificationType =
  | 'friend_request'
  | 'friend_request_accepted'
  | 'group_invite'
  | 'group_join_request'
  | 'mention'
  | 'missed_call'              // only if voice is in scope (see UI FLAG #1)
  | 'generic';

interface Notification {
  id: string;
  type: NotificationType;
  actor: PublicUser | null;    // who triggered it (null for system)
  read: boolean;
  createdAt: string;
  // payload varies by type; ids let the FE call the right action endpoint:
  payload: {
    requestId?: string;        // friend_request / group_join_request → accept/decline
    inviteId?: string;         // group_invite → accept/decline
    groupId?: string;
    conversationId?: string;   // mention → navigate here
    messageId?: string;
    text?: string;             // generic display text
  };
}
```

---

## FR → endpoint coverage

| FR | Endpoint(s) / event(s) | File |
|---|---|---|
| FR-01 | `POST /auth/signup`, `POST /auth/login` | auth |
| FR-02 | `GET /auth/google`, `GET /auth/google/callback` | auth |
| FR-03 | `POST /auth/logout` | auth |
| FR-04 | `POST /auth/password-reset/request`, `…/confirm` | auth |
| FR-05 | `GET /users/search` | users |
| FR-06 | `POST /contacts/requests` + accept/decline | contacts |
| FR-07 | `DELETE /contacts/:userId` | contacts |
| FR-08 | `POST /contacts/blocks` | contacts |
| FR-09 | `DELETE /contacts/blocks/:userId` | contacts |
| FR-10 | `PATCH /users/me/presence` + `presence:changed` | users / realtime |
| FR-11 | `PATCH /users/me`, `PUT /users/me/avatar` | users |
| FR-12 | `POST /conversations/dm` | conversations |
| FR-13 | `POST /conversations/:id/messages` + `message:new` | messages / realtime |
| FR-14 | `message:read` + `message:status` | realtime |
| FR-15 | `typing:start` / `typing:stop` | realtime |
| FR-16 | `DELETE /messages/:id` + `message:deleted` | messages / realtime |
| FR-17 | `POST /attachments` | messages |
| FR-18 | `POST /groups` | groups |
| FR-19 | `POST /groups/:id/members`, invite link, join | groups |
| FR-20 | `PATCH /groups/:id/members/:userId` (role) | groups |
| FR-21 | `DELETE /groups/:id/members/:userId` (admin) | groups |
| FR-22 | `DELETE /groups/:id/members/:userId` (self) | groups |
| FR-23 | `PATCH /groups/:id` | groups |
| FR-30 | `GET /notifications` + `notification:new` | notifications / realtime |
