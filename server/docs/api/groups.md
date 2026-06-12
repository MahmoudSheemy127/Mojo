# Groups — API Contract

Covers group lifecycle: creation, profile edits, members, roles, invites/links, and
leaving. Group messages use the `messages.md` endpoints (a group is a `Conversation`
of type `group`). Shared types in `README.md`.

> Authorization recap: `Admin` means the caller holds `role: 'admin'` in the target
> group. The group's `conversationId` equals the group `id` (a group *is* a
> conversation) — confirm this 1:1 mapping in Phase 4, or expose both ids.

---

## Create a group

Flow: `[FE] —(name, description?, avatarId?, memberIds[])→ [BE] —(create group, set creator as admin, add/invite members)→ (Group)→ [FE]` + `[BE] —(notification:new / conversation:new)→ [members]`

`POST /groups` · **Authenticated** · FR-18

Request body:
```typescript
{
  name: string;            // 1–80 chars
  description?: string;    // ≤ 300 chars
  avatarId?: string;       // from an avatar/attachment upload (optional)
  memberIds?: string[];    // initial members (must be the caller's contacts, not blocked)
}
```

Response `201`: `Group` (caller's `role` is `admin`).

Behavior:
- Creator becomes the first admin (FR-18).
- Initial members are added directly or invited depending on policy (see FLAG below);
  default for creator-added members: added directly.
- Non-contact or blocked `memberIds` → `403 BLOCKED` / `422 VALIDATION_ERROR`.

Realtime: each added member gets `conversation:new`; invited members get
`notification:new` (type `group_invite`).

---

## Get group detail

`GET /groups/:groupId` · **Authenticated** (member)

Response `200`: `Group` **with `members: GroupMember[]` populated**.

Errors: `403 FORBIDDEN` / `404 NOT_FOUND` (non-member).

> FE: query key `['groups', groupId]`; powers the Group Settings modal.

---

## Update group profile

Flow: `[FE] —(name?, description?, avatar?)→ [BE] —(authorize admin, persist)→ (Group)→ [FE]` + `[BE] —(group:updated)→ [members]`

`PATCH /groups/:groupId` · **Admin** · FR-23

Request body (send only changed fields):
```typescript
{
  name?: string;
  description?: string | null;
  avatarId?: string | null;   // null clears avatar
}
```

Response `200`: updated `Group`.

Errors: `403 FORBIDDEN` (not admin), `422 VALIDATION_ERROR`.

Realtime: `group:updated { group }` to all members (updates chat list + header live).

---

## Delete group

Flow: `[FE] —(groupId, confirm)→ [BE] —(authorize admin, delete group + membership)→ (204)→ [FE]` + `[BE] —(group:updated/removed)→ [members]`

`DELETE /groups/:groupId` · **Admin** · (FR-18 lifecycle)

Response `204`. Removes the group for all members.

Errors: `403 FORBIDDEN`.

Realtime: members receive a removal event (`group:updated` with a deleted flag, or a
dedicated `group:deleted` — pick one in Phase 4 and use consistently). Their open
chat window for this group closes to the empty state.

---

## List members

`GET /groups/:groupId/members?cursor=&limit=` · **Authenticated** (member) · 

Response `200`: `Paginated<GroupMember>`.

> FE: query key `['groups', groupId, 'members']`.

---

## Add / invite members

Flow: `[FE] —(userIds[])→ [BE] —(authorize, add or create invites)→ (added[], invited[])→ [FE]` + `[BE] —(conversation:new / notification:new)→ [targets]`

`POST /groups/:groupId/members` · **Admin** (or per policy) · FR-19

Request body:
```typescript
{ userIds: string[]; }   // caller's contacts; not blocked
```

Response `201`:
```typescript
{
  added: GroupMember[];     // joined directly
  invited: PublicUser[];    // sent an invite (pending acceptance)
}
```

Behavior depends on the join policy (**FLAG**, see below):
- **Admin adds** → members added directly (`added`).
- **Non-admin invites** (if allowed) → creates a `group_join_request` for admins to
  approve, rather than adding directly.

Errors: `403 FORBIDDEN`, `403 BLOCKED`, `422 VALIDATION_ERROR`.

Realtime: `conversation:new` to added members; `notification:new`
(type `group_invite`) to invited users; `member:added { groupId, member }` to existing
members.

---

## Change a member's role (promote / demote)

Flow: `[FE] —(userId, role)→ [BE] —(authorize admin, update role, guard last-admin)→ (GroupMember)→ [FE]` + `[BE] —(member:role_changed)→ [members]`

`PATCH /groups/:groupId/members/:userId` · **Admin** · FR-20

Request body:
```typescript
{ role: GroupRole; }   // 'admin' | 'member'
```

Response `200`: updated `GroupMember`.

Behavior: the server must prevent demoting the **last admin** (would orphan the group)
→ `409 CONFLICT` (`LAST_ADMIN`). 

Realtime: `member:role_changed { groupId, userId, role }` to all members. A promoted
member gains the Group Settings entry; a demoted self closes/locks the settings modal.

---

## Remove a member  /  Leave a group

Flow (remove): `[FE] —(userId ≠ self)→ [BE] —(authorize admin)→ (204)→ [FE]` + `[BE] —(member:removed)→ [members + removed user]`
Flow (leave): `[FE] —(userId = self)→ [BE] —(remove self, reassign/guard last admin)→ (204)→ [FE]`

`DELETE /groups/:groupId/members/:userId` · **Authenticated** · FR-21 (remove) / FR-22 (leave)

One endpoint, authorization branches on the target:
- `:userId` is **another member** → caller must be **Admin** (FR-21, remove).
- `:userId` is **self** → any member may leave (FR-22).

Response `204`.

Behavior: if the leaver/removed is the last admin, the server must either block the
action (`409 LAST_ADMIN`) or auto-promote the oldest remaining member — **decide in
Phase 4** and document the chosen rule.

Errors: `403 FORBIDDEN` (non-admin removing someone else), `409 CONFLICT` (`LAST_ADMIN`),
`404 NOT_FOUND`.

Realtime: `member:removed { groupId, userId }` to remaining members; the removed/left
user receives it too so their group chat closes.

---

## Invite link

Flow: `[FE] —(generate)→ [BE] —(authorize, mint link token)→ (url, token, expiresAt)→ [FE]`

`POST /groups/:groupId/invite-link` · **Admin** (or per policy) · FR-19

Response `201`:
```typescript
{
  url: string;          // shareable link, e.g. {FE_URL}/join/<token>
  token: string;
  expiresAt: string | null;   // null = no expiry
}
```

### Join via link
Flow: `[FE /join/:token] —(inviteToken)→ [BE] —(validate, add or create join request)→ (Group | { pending: true })→ [FE]`

`POST /groups/join` · **Authenticated** · FR-19

Request body:
```typescript
{ inviteToken: string; }
```

Response:
- `200`/`201` with `Group` if joined directly, **or**
- `202` `{ pending: true }` if the join requires admin approval (creates a
  `group_join_request` notification to admins).

Errors: `410`/`400` (`INVITE_INVALID` — expired/used), `403 BLOCKED`,
`409 CONFLICT` (`ALREADY_MEMBER`).

---

## Group join-request approval (conditional)

> **FLAG (UI #3):** these endpoints exist only if the "non-admin invites / link joins
> need admin approval" model is adopted. If groups allow direct joins, omit them.

`POST /groups/:groupId/join-requests/:requestId/accept` · **Admin** → `200 { member: GroupMember }`
`POST /groups/:groupId/join-requests/:requestId/decline` · **Admin** → `204`

Realtime: on accept, `conversation:new` to the new member and `member:added` to the group.

---

## Implementation notes

- **BE**: `groups.controller.ts`. Centralize role checks in a guard/middleware
  (`requireGroupRole('admin')`). The last-admin rule and the join-policy decision are
  the two pieces of real business logic — settle both in Phase 4 detailed design.
- **FE**: `features/groups/api.ts` → `createGroup`, `getGroup`, `updateGroup`,
  `deleteGroup`, `listMembers`, `inviteMembers`, `changeRole`, `removeMember`,
  `leaveGroup` (calls the member-delete with self id), `generateInviteLink`, `joinByLink`.
- Group socket events (`member:added`, `member:removed`, `member:role_changed`,
  `group:updated`) all invalidate `['groups', groupId]` and may update `['conversations']`.
