# Chat Window — Component (middle region)

> The core messaging surface: message history, composer, and a contextual header.
> Used for both 1-on-1 DMs and group chats (small variations noted).

## Requirements covered
- FR-08 — Block a user (from the header menu in a DM) **[GAP added]**.
- FR-12 — 1-on-1 DM conversation.
- FR-13 — Send/receive/view text messages in real time.
- FR-14 — Delivery status: Sent / Delivered / Read **[detail added]**.
- FR-15 — Typing indicator **[detail added]**.
- FR-16 — Delete own message (soft-delete) **[GAP added]**.
- FR-17 — Image/file sharing (P3).
- FR-19 — Entry to Invite members.
- FR-22 — Leave group (member, from header menu) **[GAP added]**.
- FR-23 — Entry to Group settings (admin).
- FR-30 — Mentions (`@`) feed notifications **[detail added]**.

## Placement & layout
Fills the middle region. Three stacked zones:
```
┌─ Header bar (contextual) ─────────────────────┐
│ avatar  name/presence      [call][invite][⋯]  │
├───────────────────────────────────────────────┤
│                                               │
│   Message history (scrolls, newest at bottom) │
│                                               │
├───────────────────────────────────────────────┤
│ [📎] message text box … [ Send ]              │  ← composer
└───────────────────────────────────────────────┘
```

## Structure

### Contextual header
- **Left**: contact/group avatar + name. For DMs: presence dot + status text. For
  groups: member count.
- **Right action buttons**:
  - **Voice call** → opens Voice call window (component 08). **[FLAG]** no FR — hide
    if voice is cut from MVP.
  - **Invite members** (FR-19):
    - In a **DM**: opens Create group form pre-seeded with this friend as a member.
    - In a **group**: opens Invite members component.
  - **Overflow menu (⋯)**:
    - DM: **Block user** (FR-08, confirm), **Remove friend** (FR-07).
    - Group, admin: **Group settings** (FR-23 → component 06).
    - Group, member: **Leave group** (FR-22, confirm) **[GAP added]**.
- On narrow screens: a back arrow returns to the Chat list.

### Message history
- Reverse-chronological load, displayed oldest→newest with newest pinned to bottom.
- **Message row**:
  - Sender avatar + name + timestamp (group consecutive messages from the same sender
    Discord-style: collapse repeated avatar/name).
  - Message text (supports line breaks, links, emoji; `@mentions` highlighted).
  - **Own messages**: show delivery status indicator (FR-14): Sending → Sent →
    Delivered → Read. Render as small icon/text under or beside the message
    (e.g. single check = sent/delivered, double/colored = read).
  - Attachments (FR-17, P3): inline image thumbnails; file chips with name/size/download.
  - **Hover / long-press** reveals a row action menu: **Delete** (own messages only,
    FR-16 → soft-delete), and optionally Copy. Deleted messages render as a muted
    "This message was deleted" placeholder in place.
- **Typing indicator** (FR-15): animated "<name> is typing…" (or "several people are
  typing…" in groups) shown just above the composer.
- **Date dividers** between days. **New-messages divider** at first unread.
- **Unread jump**: a "Jump to latest" button appears when scrolled up and new
  messages arrive.

### Composer
- **Attachment button** (📎, FR-17 P3) → file/image picker; shows pending attachment
  previews above the text box with remove buttons.
- **Text box**: multiline, auto-grows; placeholder "Message <name>".
  - **Enter** sends; **Shift+Enter** newline.
  - `@` triggers mention autocomplete of conversation members (feeds FR-30).
  - Typing emits typing events (debounced/throttled) for FR-15.
- **Send button**: enabled when text or attachment present.

## States
- **Loading history** — skeleton bubbles.
- **Empty conversation** — "This is the start of your conversation with <name>."
- **Loading older (scroll-up)** — top spinner during pagination.
- **Sending / failed message** — optimistic bubble shows "Sending…"; on failure shows
  retry + delete affordance.
- **Blocked DM** — if the other user is blocked, composer is disabled with a notice and
  an Unblock shortcut; if current user is blocked, sends fail silently/with notice
  (per FR-08 server enforcement).
- **Realtime disconnected** — composer still usable (queues), history read-only banner
  ("Reconnecting…"); messages flush on reconnect with replay (reliability NFR).
- **Attachment too large / invalid** — inline error on the pending attachment.

## Interactions
- New incoming messages append live and auto-scroll only if already at bottom.
- Read receipts (FR-14): viewing the conversation marks incoming messages read and
  emits read events; sender's status updates to Read live.
- Deleting own message (FR-16) emits a soft-delete; all participants see the
  placeholder.
- Block (FR-08) immediately disables the DM and updates the friend's state.

## Data needed
- Conversation metadata (type, participants, current user's role).
- Paginated message history (cursor-based) + realtime message stream.
- Per-message delivery/read state.
- Typing events in/out; presence for DM header.
- Attachment upload endpoint (P3).

## Navigation
- Voice call → component 08 (pending FR).
- Invite → component 12 (DM) or component 07 (group).
- Group settings → component 06 (admin).
- Block/Remove/Leave act in place (with confirms) and may return to the empty state.

## Notes & open questions
- Define delivery-status icon semantics precisely for Phase 3 (what counts as
  "Delivered" vs "Read", group semantics — read by all vs by any).
- Decide message edit support (not in FRs — currently delete only).
- Group read receipts can be expensive; consider limiting to DMs for MVP.
