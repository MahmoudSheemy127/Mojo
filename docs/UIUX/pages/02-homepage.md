# Homepage — Page

> The authenticated app shell. Composes the Header bar, Chat list, and the swappable
> middle region. This is where users spend ~all of their time.

## Requirements covered
- Composition only — delegates to child components. Indirectly hosts FR-05 through
  FR-30 via the components it mounts.

## Placement & layout
The persistent two-column shell under a full-width header (see global layout in README):

```
┌───────────────────────────────────────────────┐
│  Header bar                                     │  ← components/09
├──────────────┬──────────────────────────────────┤
│ Chat list    │  Middle region (one of):         │
│ (left,~300px)│   • Empty state (no chat open)    │
│ components/04│   • Chat window  (components/05)   │
│              │   • Voice call   (components/08)   │
│              │  + overlay modals when triggered  │
└──────────────┴──────────────────────────────────┘
```

## Structure
- **Header bar** (fixed top, full width).
- **Chat list** (fixed left column).
- **Middle region** (flex fill):
  - **Empty state** when no conversation is selected: centered illustration/icon +
    "Select a conversation or find friends to start chatting" + quick actions
    (Find friends, Create group).
  - **Chat window** when a chat/group is selected.
  - **Voice call window** when a call is active (**[FLAG]** pending FR — see README).
- **Overlay layer** for modals/popups: Create group, Find friends, Invite members,
  Group settings, Notification dropdown, Profile popup.

## States
- **No selection** — middle region shows empty state.
- **Conversation open** — chat window mounted with selected conversation.
- **Call active** — voice call window replaces chat window; chat list stays.
- **Realtime disconnected** — a slim banner across the top of the middle region:
  "Reconnecting…" (graceful degradation NFR; history still readable).
- **Loading session** — on first load, show skeletons in chat list while data fetches.

## Interactions
- Selecting an item in the Chat list sets the active conversation and mounts the
  chat window. Active item is highlighted in the list.
- Opening a modal dims the background and traps focus; Esc closes it.
- Only one modal at a time; opening a new one closes the previous.
- Deep-linkable: routes like `/c/:conversationId` restore the open conversation on reload.
- Layout state (which conversation is open) survives WebSocket reconnects.

## Data needed
- Current user profile + presence.
- Conversation/session list (for the chat list).
- Selected conversation messages (lazy-loaded by the chat window).
- Unread counts + notification count (drives badges in chat list and header).

## Navigation
- **Entry** ← successful auth from Login/Signup.
- **To Settings** ← header profile popup → settings gear.
- **Logout** ← header profile popup or Settings → returns to Login/Signup.
- Internal swaps between empty / chat / call are state, not route changes (except the
  conversation deep-link).

## Notes & open questions
- **[GAP]** Define the empty state explicitly — it's the first thing a brand-new user
  sees with no contacts yet; lead them to Find friends.
- Consider a persistent unread/mention badge strategy shared between chat list and header.
