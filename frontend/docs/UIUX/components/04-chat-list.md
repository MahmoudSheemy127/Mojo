# Chat List — Component (left column)

> The persistent left navigation: switch between active conversations and the
> friends/groups directory, and launch the create-group and find-friends flows.

## Requirements covered
- FR-05 — entry to user search (Find friends button).
- FR-06 — surfaced indirectly (friends appear here once accepted).
- FR-07 — Remove a contact (**[GAP]** added to friend row context menu).
- FR-12 — Start 1-on-1 DM (click a friend).
- FR-18 — entry to Create group (Create group button).
- Hosts presence display for friends (FR-10) and group membership (FR-22 leave, via menu).

## Placement & layout
- Fixed left column (~300px) on the Homepage, full height below the header.
- Top: action buttons. Below: tab switcher. Below: the active tab's list (scrolls).

## Structure
```
┌─ Chat list ───────────────────────┐
│ [ + Create group ] [ Find friends ]│  ← action buttons
│ ┌───────────┬────────────────────┐ │
│ │  Chats    │ Friends & groups   │ │  ← tabs
│ └───────────┴────────────────────┘ │
│  (active tab content, scrolls)     │
└────────────────────────────────────┘
```

### Action buttons
- **Create group** → opens Create group form (component 12).
- **Find friends** → opens Find friends form (component 10). *(Same modal as the
  header's Find friends entry — see README FLAG #2.)*

### Tab 1 — Chat sessions
- List of active conversations (DMs and groups the user has messaged in),
  **sorted by most-recent activity**.
- Each row:
  - Avatar (user avatar + presence dot for DMs; group avatar for groups).
  - Name (display name or group name).
  - Last-message preview (truncated; "You: …" prefix when sent by current user;
    "typing…" replaces preview when the other party is typing).
  - Timestamp of last message (relative).
  - Unread badge (count) when there are unread messages; bold row when unread.
- **Click** → opens that conversation in the Chat window.

### Tab 2 — Friends & groups
- **Friends** subsection:
  - Each friend row: avatar + presence dot, display name, status text.
  - **Click** → opens (or starts) the 1-on-1 DM (FR-12).
  - Row overflow menu (⋯ on hover / long-press): **Message**, **Block** (FR-08),
    **Remove friend** (FR-07) — destructive, confirm. **[GAP added]**
  - Optionally group friends by presence (Online first), Discord-style.
- **Groups** subsection:
  - Each group row: group avatar + group name (+ member count optional).
  - **Click** → opens the group conversation.
  - Row overflow menu: **Open**, **Leave group** (FR-22, confirm) **[GAP added]**.

## States
- **Loading** — skeleton rows.
- **Empty (Chats tab)** — "No conversations yet. Find a friend to start chatting."
  with a Find friends shortcut.
- **Empty (Friends/groups tab)** — separate empty messages for no friends / no groups.
- **Error** — inline error + retry.
- **Active row** — selected conversation is highlighted.
- **Unread** — badge + emphasized text.

## Interactions
- Tab switch is instant (client state); preserve scroll position per tab.
- Realtime: new message bumps a conversation to the top of the Chats list and updates
  preview + unread badge live (Socket.io). Presence changes update dots live (FR-10).
- Selecting a conversation clears its unread badge.
- Infinite scroll / pagination for long lists.

## Data needed
- Conversation sessions (id, type, name, avatar, last message, timestamp, unread count).
- Friends list (id, name, avatar, presence).
- Joined groups (id, name, avatar, member count, current user's role).
- Realtime subscriptions: new-message, presence-change, typing.

## Navigation
- Create group → component 12.
- Find friends → component 10.
- Row click → Chat window (component 05) in the middle region.

## Notes & open questions
- Confirm whether the Chats tab includes group chats inline (recommended) or only DMs.
- Define sort tie-breakers (pinned? muted conversations sink?).
- **[GAP]** Public rooms (if FR-24–28 ship) would likely need a third tab or section here.
