# Settings — Page

> Account management: profile editing, password reset, logout, and (added) blocked
> users management.

## Requirements covered
- FR-03 — Logout + invalidate session/token.
- FR-04 — Password reset.
- FR-09 — Unblock users (**[GAP]** no UI home existed for unblock).
- FR-11 — Edit profile: display name, avatar, bio.

## Placement & layout
- Full-page (or large modal) reached from the header profile popup → gear icon.
- Left vertical nav of sections + right content pane (Discord-style settings), or a
  single scrolling page with section anchors on smaller screens.
- A clear way back to the Homepage (back arrow / Esc / close).

## Structure (sections)

### 1. Edit account / profile (FR-11)
- Avatar uploader (click to change; shows current or initials fallback; supports
  remove → revert to initials).
- Display name field.
- Username (display only, or editable — **decide**; affects search/uniqueness).
- Short bio textarea (with character counter).
- **Save changes** button (disabled until something changes); inline success toast.

### 2. Account security
- **Change / reset password** (FR-04):
  - Logged-in change: current password + new password + confirm.
  - Or "Send password reset email" that uses the same emailed-link flow as Login.
- (If applicable) Connected accounts: shows Google linked/unlinked (FR-02).

### 3. Blocked users (FR-09) **[GAP added]**
- List of users the current user has blocked (avatar + username).
- **Unblock** button per row → confirm → row removed; toast.
- Empty state: "You haven't blocked anyone."

### 4. Logout (FR-03)
- **Log out** button (destructive styling).
- On click: invalidate token/session server-side, clear local tokens, redirect to Login.
- Optional: "Log out of all devices" (revoke all refresh tokens) — nice-to-have.

## States
- **Default / loaded.**
- **Saving** — section button spinner; fields disabled.
- **Validation error** — inline (e.g. bio too long, password mismatch).
- **Avatar uploading** — progress indicator; error on too-large/invalid file.
- **Blocked list: loading / empty / error.**

## Interactions
- Unsaved-changes guard: warn before navigating away with pending edits.
- Avatar upload validates type/size client-side before upload.
- Logout is immediate after confirm (no undo).

## Data needed
- GET current profile (name, username, avatar URL, bio).
- PATCH profile.
- POST change-password / POST reset-request.
- GET blocked users; DELETE block (unblock).
- POST logout (token invalidation).

## Navigation
- **Entry** ← Header profile popup → gear.
- **Exit** → Homepage (back/close), or → Login (after logout).

## Notes & open questions
- Decide if username is immutable. If mutable, plan for search/index implications.
- Account deletion (GDPR / privacy NFR) likely belongs here too — **[GAP]** add a
  "Delete account" section if data-deletion is in scope for this phase.
