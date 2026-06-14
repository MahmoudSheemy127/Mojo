# Users — API Contract

Covers the current user's profile, avatar, presence, and searching for other users.
Shared types (`PublicUser`, `SelfUser`, `Presence`, `Relationship`, `Paginated<T>`)
are in `README.md`.

---

## Get current user

Flow: `[FE] —(access token)→ [BE] —(load self)→ (SelfUser)→ [FE]`

`GET /users/me` · **Authenticated**

Response `200`: `SelfUser`.

> FE: cached under query key `['me']`; fetched once on app load.

---

## Update profile

Flow: `[FE] —(displayName?, bio?)→ [BE] —(validate, persist)→ (SelfUser)→ [FE]`

`PATCH /users/me` · **Authenticated** · FR-11

Request body (all fields optional; send only what changed):
```typescript
{
  displayName?: string;  // 1–50 chars
  bio?: string | null;   // ≤ 190 chars; null clears it
}
```

Response `200`: updated `SelfUser`.

Errors: `422 VALIDATION_ERROR`.

Realtime: profile changes that affect how the user appears to others may emit a
lightweight `presence:changed`-style update; for MVP, contacts pick up new
displayName/avatar on their next fetch. (No dedicated event required.)

---

## Update avatar

Flow: `[FE] —(multipart image)→ [BE] —(validate, store in object storage, set URL)→ (avatarUrl)→ [FE]`

`PUT /users/me/avatar` · **Authenticated** · FR-11

Request: `multipart/form-data` with field `file` (image; server enforces type and
max size). To remove an avatar, use `DELETE /users/me/avatar`.

Response `200`:
```typescript
{ avatarUrl: string; }
```

Errors: `422 VALIDATION_ERROR` (wrong type), `413` (too large, code `FILE_TOO_LARGE`).

> Object storage (S3/R2) is a P3 dependency; until then the BE may store avatars
> locally or accept a URL. The contract shape is stable either way.

---

## Set presence status

Flow: `[FE] —(status)→ [BE] —(persist, broadcast to contacts)→ (Presence)→ [FE]` + `[BE] —(presence:changed)→ [contacts]`

`PATCH /users/me/presence` · **Authenticated** · FR-10

Request body:
```typescript
{ status: Exclude<Presence, 'offline'>; }  // 'online' | 'away' | 'dnd'
```
> `offline` is set automatically by the server when the user's socket disconnects;
> it is not a manually-settable value here. (If an "Invisible" feature is wanted,
> add it explicitly — see UI FLAG.)

Response `200`:
```typescript
{ presence: Presence; }
```

Realtime: emits `presence:changed { userId, status }` to the user's contacts
(see `realtime.md`).

> Connection-driven presence: the socket connection itself flips the user to `online`
> on connect and `offline` on disconnect (after a short grace period). This REST
> endpoint is for explicit Away / Do Not Disturb choices.

---

## Search users

Flow: `[FE] —(q, cursor?)→ [BE] —(partial username match, exclude self & blocked)→ (Paginated<UserSearchResult>)→ [FE]`

`GET /users/search?q=<string>&cursor=<opaque>&limit=<n>` · **Authenticated** · FR-05

Query params:
- `q` — partial username, min 1 char. Server does case-insensitive prefix/substring match.
- `cursor`, `limit` — pagination (README).

Response `200`: `Paginated<UserSearchResult>` where:
```typescript
interface UserSearchResult {
  user: PublicUser;
  relationship: Relationship;   // drives the FE row action (Add / Requested / Friends…)
}
```
- The caller is excluded from results.
- Users the caller has blocked, or who have blocked the caller, are excluded
  (FR-08 enforcement, server-side).

Errors: `422 VALIDATION_ERROR` (missing `q`), `429 RATE_LIMITED`.

> FE: query key `['users', 'search', q]`; debounced ~300ms; infinite scroll on `nextCursor`.
> This is the **global** search (Find Friends). It is distinct from the friend-scoped
> search used by the group MemberPicker (see `contacts.md` / `groups.md`).

---

## Get a user's public profile

Flow: `[FE] —(userId)→ [BE] —(load public profile)→ (PublicUser)→ [FE]`

`GET /users/:userId` · **Authenticated**

Response `200`: `PublicUser`.

Errors: `404 NOT_FOUND`, `403 BLOCKED` (if a block relationship hides the profile —
decide policy; default: return `404` to avoid leaking existence).

---

## Implementation notes

- **BE**: `users.controller.ts`. Search must use an indexed, case-insensitive username
  lookup (Postgres `citext` or a functional index / `tsvector`) and always apply the
  block filter at the query level.
- **FE**: `features/settings/api.ts` (`updateProfile`, `uploadAvatar`),
  `features/presence/api.ts` (`updatePresence`), `features/contacts/api.ts`
  (`searchUsers`).
