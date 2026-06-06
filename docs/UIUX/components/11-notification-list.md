# Notification List — Component (dropdown from the bell)

> Dropdown anchored to the header notification bell. Shows actionable requests and
> generic notifications.

## Requirements covered
- FR-06 — Accept/decline friend requests (the action side of contact requests).
- FR-19 — Accept/decline group invitations; approve/deny group join requests.
- FR-30 — In-app notifications for new messages, invites, and mentions.

## Placement & layout
- Dropdown panel anchored below-right of the bell; dimmed/auto-close on outside click
  or Esc. Fixed max height with its own scroll; on mobile may go full-screen.
- Header row: "Notifications" + optional "Mark all as read".

## Structure — notification record types
Each record: actor avatar, text, relative timestamp, unread indicator, and
type-specific actions.

1. **Friend invitation** (FR-06): "<user> wants to add you."
   - Actions: **Accept** / **Decline**.
   - On accept: they become a contact (appear in Friends tab); toast.
2. **Group invitation** (FR-19): "<user> invited you to <group>."
   - Actions: **Accept** / **Decline**.
   - On accept: group appears in Groups list; opens/active.
3. **Group join request** (FR-19): "<user> wants to join <group>."
   - Shown to **group admins** (e.g. when a non-admin invited someone, or someone
     requests via link). **[FLAG]** depends on the join-approval rule (README FLAG #3).
   - Actions: **Accept** / **Decline**.
4. **Generic notification** (FR-30): non-actionable info, e.g.
   - "<user> accepted your friend request."
   - "<user> mentioned you in <group>." → click navigates to that message.
   - "Missed call from <user>." **[FLAG]** only if voice is in scope (README FLAG #1).
   - New-message notifications (FR-30) — **decide** whether these appear here or are
     represented only by unread badges in the Chat list (recommended: badges for
     messages, this list for invites/mentions/system events, to avoid noise).

## States
- **Loading** — skeleton rows.
- **Empty** — "You're all caught up."
- **Error** — inline + retry.
- **Action pending** — Accept/Decline buttons show spinner; row resolves/removes on success.
- **Unread vs read** — unread rows emphasized; opening the panel marks them seen
  (clears the bell badge) without auto-resolving actionable items.

## Interactions
- Accept/Decline call the relevant endpoint and update the row in place (then remove
  or mark resolved). Corresponding lists update live (friends/groups).
- Clicking a mention notification navigates to the referenced conversation/message.
- New notifications arrive live via Socket.io and update the bell badge.

## Data needed
- GET notifications (paginated) with type + payload + read state.
- POST accept/decline for friend requests, group invites, join requests.
- Realtime notification stream; read-state updates.

## Navigation
- Anchored to Header bar bell (component 09).
- Mention click → Chat window (component 05) at the relevant message.

## Notes & open questions
- Decide the message-notification policy (this list vs unread badges) to prevent overload.
- Group join-request visibility depends on the approval model — confirm with FLAG #3.
