# Header Bar — Component (top, full width)

> Persistent top bar on the Homepage: global find-friends entry, notifications, and
> the profile/presence/settings popover.

## Requirements covered
- FR-03 — Logout (via profile popup, mirrors Settings).
- FR-05 — Entry to user search (Find friends).
- FR-10 — Set presence status (status switcher in profile popup).
- FR-30 — Notifications (bell + dropdown).

## Placement & layout
- Fixed top, full width, above the Chat list and middle region.
- **Left/center**: app name/logo; (optional) global search field.
- **Right cluster**: Find friends, Notification bell, Profile avatar.

## Structure

### Find friends button (FR-05)
- Opens the Find friends form (component 10). **Same modal** as the Chat list's Find
  friends button — one shared component, two entry points (README FLAG #2).

### Notification icon (FR-30)
- Bell icon with an unread **count badge**.
- Click toggles the Notification list dropdown (component 11), anchored to the bell.

### Profile icon → profile popover
- Circular avatar (+ presence dot reflecting current status).
- Click opens a small popover containing:
  - **Username** + display name + current presence label.
  - **Availability status switcher** (FR-10): clicking opens a sub-list —
    Online, Away, Do Not Disturb, Offline (Invisible). Selecting updates presence
    immediately and broadcasts it (live to others).
  - **Settings** gear → Settings page (component/page 03).
  - **Log out** (FR-03) → invalidate token, redirect to Login. *(Mirrors Settings;
    confirm whether logout lives here, in Settings, or both — both is fine.)*

## States
- **Notification badge**: hidden at zero; shows count (cap at "9+").
- **Popover open/closed**; only one of notification/profile open at a time.
- **Presence updating** — brief pending state on the selected status.
- **Disconnected** — presence may show as offline/uncertain; reflect realtime state.

## Interactions
- Bell and profile popovers toggle on click and close on outside-click / Esc.
- Changing presence updates the dot here and the user's appearance in others' lists live.
- Opening notifications can mark them as seen (clears the badge) while leaving
  actionable items (friend/group requests) still actionable.

## Data needed
- Current user (avatar, username, display name, presence).
- Unread notification count + realtime updates.
- PATCH presence status.

## Navigation
- Find friends → component 10.
- Notifications → component 11 (dropdown).
- Settings → page 03. Logout → Login page.

## Notes & open questions
- Decide if there's a global search in the header beyond Find friends (e.g. message
  search) — not in current FRs.
- "Offline" vs "Invisible": clarify whether selecting Offline truly disconnects or
  just appears offline (presence FR-10).
