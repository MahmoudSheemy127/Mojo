# Contacts — API Contract

Covers the friendship/contact graph: requests, accept/decline, removal, and blocking.
Shared types in `README.md`.

> Contact requests appear in the recipient's notification feed (`notifications.md`),
> whose payload carries the `requestId` used by the accept/decline endpoints here.

---

## List friends

Flow: `[FE] —(access token)→ [BE] —(load accepted contacts + presence)→ (Paginated<PublicUser>)→ [FE]`

`GET /contacts?cursor=&limit=` · **Authenticated** · FR-06

Response `200`: `Paginated<PublicUser>` (each includes live-ish `presence`).

> FE: query key `['contacts', 'friends']`; rows update via `presence:changed` events.

---

## List pending requests

Flow: `[FE] —(direction?)→ [BE] —(load pending)→ (incoming[], outgoing[])→ [FE]`

`GET /contacts/requests` · **Authenticated** · FR-06

Response `200`:
```typescript
{
  incoming: ContactRequest[];   // others → caller
  outgoing: ContactRequest[];   // caller → others
}

interface ContactRequest {
  id: string;
  from: PublicUser;
  to: PublicUser;
  createdAt: string;
}
```

---

## Send a friend request

Flow: `[FE] —(userId)→ [BE] —(create pending request, notify target)→ (ContactRequest)→ [FE]` + `[BE] —(notification:new)→ [target]`

`POST /contacts/requests` · **Authenticated** · FR-06

Request body:
```typescript
{ userId: string; }   // target user
```

Response `201`: `ContactRequest`.

Behavior:
- If the target has already sent the caller a request, the server **auto-accepts**
  (both become friends) and returns the resulting friendship instead of a new pending
  request. (Resolves UI FLAG on mutual requests.)
- Blocked in either direction → `403 BLOCKED`.

Errors: `404 NOT_FOUND` (no such user), `409 CONFLICT` (`ALREADY_FRIENDS` |
`REQUEST_EXISTS`), `403 BLOCKED`, `429 RATE_LIMITED`.

Realtime: `notification:new` (type `friend_request`) to the target.

---

## Accept a friend request

Flow: `[FE] —(requestId)→ [BE] —(create friendship, notify requester)→ (PublicUser)→ [FE]` + `[BE] —(notification:new + conversation:new)→ [requester]`

`POST /contacts/requests/:requestId/accept` · **Authenticated** · FR-06

Response `200`:
```typescript
{ friend: PublicUser; }
```

Realtime: `notification:new` (type `friend_request_accepted`) to the original
requester. A DM conversation becomes available to both (see `conversations.md`).

Errors: `404 NOT_FOUND`, `403 FORBIDDEN` (caller is not the request recipient).

---

## Decline a friend request

`POST /contacts/requests/:requestId/decline` · **Authenticated** · FR-06

Response `204`. The request is removed; no friendship is created.

Errors: `404 NOT_FOUND`, `403 FORBIDDEN`.

---

## Remove a contact

Flow: `[FE] —(userId)→ [BE] —(delete friendship both ways)→ (204)→ [FE]`

`DELETE /contacts/:userId` · **Authenticated** · FR-07

Response `204`. Removes the friendship symmetrically. Existing DM history is retained
but the conversation may be hidden until re-friended (decide; default: keep visible,
new messages blocked unless still permitted).

Errors: `404 NOT_FOUND` (not a contact).

---

## Block a user

Flow: `[FE] —(userId)→ [BE] —(create block, drop friendship, hide both ways)→ (201)→ [FE]`

`POST /contacts/blocks` · **Authenticated** · FR-08

Request body:
```typescript
{ userId: string; }
```

Response `201`:
```typescript
{ blockedUser: PublicUser; }
```

Behavior (server-enforced, NF-13): once blocked, the pair cannot message, search, or
invite each other; any existing friendship/requests between them are removed. The
blocked user is not told they were blocked.

Errors: `404 NOT_FOUND`, `409 CONFLICT` (`ALREADY_BLOCKED`).

Realtime: the blocked user's active DM with the caller becomes inert; no explicit
event is required (their next send is rejected with `403 BLOCKED`).

---

## List blocked users

`GET /contacts/blocked?cursor=&limit=` · **Authenticated** · FR-09

Response `200`: `Paginated<PublicUser>`.

> FE: Settings → Blocked users. Query key `['contacts', 'blocked']`.

---

## Unblock a user

Flow: `[FE] —(userId)→ [BE] —(remove block)→ (204)→ [FE]`

`DELETE /contacts/blocks/:userId` · **Authenticated** · FR-09

Response `204`. The block is removed; the two are now strangers again (no friendship
is restored — they must re-add).

Errors: `404 NOT_FOUND` (not blocked).

---

## Implementation notes

- **BE**: `contacts.controller.ts`. The block check is a **cross-cutting guard**: it
  must be applied in user search, message send, group invite, and DM creation — not
  only here. Centralize it (e.g. a `canInteract(a, b)` service).
- **FE**: `features/contacts/api.ts` (`fetchFriends`, `searchUsers` lives in users,
  `sendFriendRequest`, `acceptRequest`, `declineRequest`, `removeFriend`, `blockUser`,
  `unblockUser`, `fetchBlocked`). Accept/decline are also reachable from the
  notification items.
