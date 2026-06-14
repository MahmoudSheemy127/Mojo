# Chat App — UI/UX Wireframe Specs

These markdown files act as text wireframes for the frontend build. Each page and
component has its own file describing layout, structure, states, interactions, data,
and navigation. They are written to be handed directly to Claude Code (or any
implementer) as the source of truth for the UI layer.

> Phase 2 · UI/UX. Pairs with the Phase 2 architecture (React 18 + Vite + Tailwind,
> Zustand for UI state, TanStack Query for server state, Socket.io-client for realtime).

## How to read these specs

- **Requirements covered** ties each screen back to a functional requirement (FR-xx).
- **Structure** lists elements top-to-bottom / left-to-right as they appear.
- **States** enumerates every visual state the implementer must build (not just the happy path).
- **Interactions** describes behavior on click/hover/keyboard/realtime events.
- Anything marked **[GAP]** was missing from the original brief and has been added during revalidation.
- Anything marked **[FLAG]** is a contradiction or scope question that needs a product decision.

## File index

### Pages
- `pages/01-login-signup.md`
- `pages/02-homepage.md`
- `pages/03-settings.md`

### Components
- `components/04-chat-list.md`
- `components/05-chat-window.md`
- `components/06-group-settings.md`
- `components/07-invite-members.md`
- `components/08-voice-call-window.md`  *(see FLAG below — no backing FR)*
- `components/09-header-bar.md`
- `components/10-find-friends-form.md`
- `components/11-notification-list.md`
- `components/12-create-group-form.md`

---

## Global theme

Modern, Discord-like, **dark-first**. Build with CSS variables / Tailwind theme tokens
so a light theme can be added later without rework.

### Reference palette (starting point, not mandatory)

| Token | Dark value | Use |
|---|---|---|
| `--bg-deepest` | `#1e1f22` | Outermost rail / page background |
| `--bg-sidebar` | `#2b2d31` | Chat list, modals, popovers |
| `--bg-chat` | `#313338` | Chat window, main content |
| `--bg-hover` | `#35373c` | List row hover |
| `--bg-active` | `#404249` | Selected list row |
| `--text-normal` | `#dbdee1` | Body text |
| `--text-muted` | `#949ba4` | Secondary text, timestamps |
| `--accent` | `#5865f2` | Primary buttons, links, active accents |
| `--danger` | `#da373c` | Destructive actions |
| `--online` | `#23a55a` | Presence: Online |
| `--idle` | `#f0b232` | Presence: Away |
| `--dnd` | `#f23f43` | Presence: Do Not Disturb |
| `--offline` | `#80848e` | Presence: Offline |

- Rounded corners (8–12px on cards/modals, full-round on avatars).
- Generous spacing, clear hover/active feedback on every interactive row.
- Avatars are circular; fall back to colored initials when no image is set.

## Global layout

Three-region shell on desktop:

```
┌──────────────────────────────────────────────────────────┐
│  Header bar (full width, fixed top)                        │
├───────────────┬────────────────────────────────────────────┤
│               │                                            │
│  Chat list    │   Chat window  /  Voice call  /  modal     │
│  (left, ~300px│   (middle, flexes to fill)                 │
│   fixed)      │                                            │
│               │                                            │
└───────────────┴────────────────────────────────────────────┘
```

- **Header bar** is persistent across the Homepage.
- **Chat list** is the persistent left column on the Homepage.
- The **middle region** swaps between: empty state, Chat window, Voice call window.
- **Modals/popups** (Create group, Find friends, Invite members, Group settings)
  overlay the middle region (or center-screen) with a dimmed backdrop.
- **Notification list** and **Profile popup** are dropdowns anchored to their header icons.

### Responsive behavior **[GAP]** — was not specified
- **≥1024px**: full two-column layout as above.
- **640–1023px**: single column. Chat list is the default view; selecting a chat
  pushes the Chat window over it with a back button in the chat header.
- **<640px**: same single-column stack; modals go full-screen.
- NFR reference: usable down to 320px width.

## Shared patterns

- **Lists** (chats, friends, users, notifications, members): support loading skeletons,
  empty states, and error states with a retry affordance. Long lists paginate via
  infinite scroll.
- **Search inputs**: debounce ~300ms; show a spinner inline while querying; show
  "No results" empty state.
- **Avatars + presence**: a small presence dot sits bottom-right of user avatars
  (not group avatars). Colors per palette above.
- **Toasts**: transient confirmations ("Friend request sent", "Group created") and
  recoverable errors appear as toasts, top-right.
- **Destructive actions** (delete group, remove member, block) require a confirm step.
- **Optimistic UI**: sending a message renders immediately as "Sending…", then
  resolves to its delivery status (see Chat window).

---

## FR → screen traceability

| FR | Requirement | Primary screen(s) |
|---|---|---|
| FR-01 | Username/password signup + login | Login/Signup |
| FR-02 | Google OAuth | Login/Signup |
| FR-03 | Logout + token invalidation | Settings; Profile popup |
| FR-04 | Password reset via email link | Login (Forgot password) **[GAP added]**; Settings |
| FR-05 | User search by username | Find Friends form |
| FR-06 | Send/accept/decline contact requests | Find Friends (send); Notification list (accept/decline) |
| FR-07 | Remove a contact | Chat list → Friends tab → row context menu **[GAP added]** |
| FR-08 | Block a user | Chat window header menu; friend row menu **[GAP added]** |
| FR-09 | Unblock a user | Settings → Blocked users **[GAP added]** |
| FR-10 | Presence status | Profile popup (status switcher) |
| FR-11 | Profile display name, avatar, bio | Settings → Edit account |
| FR-12 | Start 1-on-1 DM | Chat list → Friends tab → click friend |
| FR-13 | Realtime text messaging | Chat window |
| FR-14 | Delivery status (Sent/Delivered/Read) | Chat window message rows **[detail added]** |
| FR-15 | Typing indicator | Chat window **[detail added]** |
| FR-16 | Delete own message (soft) | Chat window message context menu **[GAP added]** |
| FR-17 | Image/file sharing (P3) | Chat window attachment button |
| FR-18 | Create group + become admin | Create group form |
| FR-19 | Invite to group (link/direct) | Invite members component |
| FR-20 | Promote/demote admins | Group settings |
| FR-21 | Remove members | Group settings **[GAP added]** |
| FR-22 | Leave a group | Group settings (members); chat header **[GAP added]** |
| FR-23 | Edit group name, description, avatar | Group settings **[expanded from "edit name" only]** |
| FR-30 | In-app notifications | Notification list |

---

## Open product questions (resolve before/with Phase 3 contract)

1. **[FLAG] Voice calling has no functional requirement.** The brief includes a Voice
   Call Window and a "Voice call" button, and notifications reference "Missed call",
   but there is no FR for voice/video. Options: (a) add an FR and design the
   signaling/media stack (WebRTC) in Phase 4, or (b) cut it from MVP and hide the
   button. The spec file exists as a placeholder but is marked out-of-scope.
2. **[FLAG] "Find Friends" appears in two places** — the Header bar and the Chat list.
   Resolution in these specs: it is one shared modal with two entry points. Confirm
   that's intended rather than two different screens.
3. **[FLAG] Non-admin group invites become "join requests"** needing admin approval
   (implied by the Notification list). This means group membership has states
   (member, invited, requested). Confirm this approval flow is wanted for MVP, or
   simplify so only admins can add members directly.
4. **[GAP] Public rooms (FR-24–28 from the full FR set) are not represented** in this
   UI brief at all. If rooms ship, they need their own discovery/browse screen and a
   room variant of the chat window. Flagged here so it isn't silently dropped.
5. **Mentions** (part of FR-30) imply an `@`-autocomplete in the message composer;
   speced in the Chat window.
