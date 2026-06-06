# Group Settings — Component (popup, middle screen)

> Admin-only popup for managing a group: profile (name/description/avatar), admin
> roles, member removal, leaving, and deletion.

## Requirements covered
- FR-20 — Promote members to admin / demote admins.
- FR-21 — Remove members from the group **[GAP added]**.
- FR-22 — Leave group **[GAP added — also surfaced from chat header for members]**.
- FR-23 — Edit group name, description, and avatar **[expanded from "edit name" only]**.

## Access control
- Opened from the Chat window header overflow menu **only when the current user is a
  group admin**. Non-admins do not see the entry (they get "Leave group" instead).

## Placement & layout
- Centered modal popup over a dimmed backdrop. Close via X, Esc, or backdrop click.
- Title "Group settings — <group name>". Tabbed or sectioned content.

## Structure (sections)

### 1. Group profile (FR-23)
- Group avatar uploader (change / remove → initials fallback).
- Group name field.
- Group description textarea (with counter). **[GAP added — was missing]**
- **Save changes** button (disabled until dirty).

### 2. Members & roles
- Member list; each row: avatar, name, role badge (Admin/Member).
- Row actions (admin-controlled):
  - **Promote to admin** / **Demote to member** (FR-20). The acting admin cannot
    demote themselves into a state with zero admins (guard against orphaning).
  - **Remove from group** (FR-21) — destructive, confirm. **[GAP added]**
- Member search/filter for large groups.

### 3. Danger zone
- **Leave group** (FR-22) — for the current user; confirm. If the leaver is the last
  admin, prompt to assign a new admin first (or auto-promote — **decide**). **[GAP added]**
- **Delete group** — destructive, double-confirm (type group name or explicit
  "Delete" confirmation). Removes the group for all members.

## States
- **Loading members** — skeleton rows.
- **Saving profile** — button spinner.
- **Role change in progress** — row shows pending state; optimistic with rollback on error.
- **Remove/leave/delete confirmations** — modal confirm dialogs.
- **Permission lost mid-session** — if the user is demoted while open, gracefully close
  to read-only or dismiss.
- **Error** — inline per action + toast.

## Interactions
- All membership/role changes propagate live to affected members (Socket.io): a
  removed member's chat window closes/locks; a promoted member gains admin entry.
- Avatar/name/description changes update the group everywhere (chat list, header) live.
- Destructive actions always confirm; deletion is irreversible.

## Data needed
- Group metadata (name, description, avatar, member list with roles).
- PATCH group profile; PATCH member role; DELETE member; POST leave; DELETE group.
- Realtime membership/role/profile change events.

## Navigation
- **Entry** ← Chat window header (admin).
- **Exit** → back to Chat window. After **Leave**/**Delete**, return to Homepage empty state.

## Notes & open questions
- Define the last-admin rule precisely (block leave, force reassign, or auto-promote
  oldest member).
- Consider an audit/log of admin actions (not in FRs; out of scope unless added).
