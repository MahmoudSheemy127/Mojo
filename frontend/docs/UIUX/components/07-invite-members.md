# Invite Members — Component (popup, middle screen)

> Popup to add people to an existing group, by searching/selecting friends and/or
> sharing an invite link.

## Requirements covered
- FR-19 — Invite users to a group via link or direct invite.

## Access control
- Opened from the Chat window header (group context) → **Invite members**.
- Who can invite depends on the group policy:
  - Admins can invite directly (member added or invited).
  - **[FLAG]** If non-admins may invite, their invite creates a **join request** that
    an admin approves (see Notification list "Group join request"). Confirm this rule.

## Placement & layout
- Centered modal over dimmed backdrop. Title "Invite to <group name>". Close via
  X / Esc / backdrop.

## Structure

### Invite by friend (direct)
- **Search bar** — searches the current user's friends (not all users), debounced.
- **Results list** — friend rows (avatar + name); already-members are shown disabled
  with a "Member" tag; already-invited show "Invited".
- **Selecting** a friend adds them to a **selected members** list shown below
  (chips or rows with remove buttons).
- **Invite members** button — sends invites to all selected; disabled when none selected.

### Invite by link
- **Invite link** field (read-only) + **Copy** button.
- Optional controls: regenerate link, set expiry / max uses (nice-to-have).
- Helper text on how the link works.

## States
- **Search: idle / searching / no results / error.**
- **No friends to invite** — empty state pointing to Find friends.
- **Selected list empty** — invite button disabled.
- **Sending invites** — button spinner; per-row success/failure feedback.
- **Link loading / link copied** — copied confirmation (toast or inline "Copied!").

## Interactions
- Selecting/deselecting updates the selected list live; can't select existing members.
- On successful invite: invited users receive a Group invitation notification
  (component 11); toast confirms; modal can stay open to invite more or close.
- Copy link writes to clipboard.

## Data needed
- Friends search (scoped to current user's contacts).
- Current group membership (to disable members / mark invited).
- POST invites (list of user ids). GET/POST invite link.
- Realtime: invited users' notification feed.

## Navigation
- **Entry** ← Chat window header (group).
- **Exit** → back to Chat window.

## Notes & open questions
- Confirm friend-only search vs global user search for inviting.
- Define invite link semantics (expiry, single/multi-use, join = direct or pending).
- Reconcile with Create group form (component 12), which has a near-identical
  member-selection pattern — build them on a shared MemberPicker.
