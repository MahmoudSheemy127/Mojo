# Frontend — Implementation Plan

> The orchestration doc for the React frontend (`chat-app/`). The contract, the UI specs,
> and `fe-design.md` describe *what the system is*; this plan describes *the order you build
> in*. Each feature follows the same four-step inner sequence — **types → API & state → UI
> → verify** — citing the reference docs at each step. A feature is done when **G0 + G3**
> are green (G4 is optional). The reviewer's verdict is the done signal; never self-declare.

## How to use this plan
- Build features in the order below; build **vertically** (finish the first slice before fanning out).
- Within a feature, follow the four steps in order. **Data layer before UI** — a component
  built against hooks that already return typed data is correct the first time; a component
  built against placeholder data needs surgery when the real hook lands.
- Every step points at a doc. This plan adds **no new specification** — it sequences and
  wires the docs you already have. (In particular, "state design" is not a separate doc:
  it's fully determined by `@contract` + `@fe-design` §2.6 + the states each `@ui` lists.)

## Source documents
| Alias | File | Role |
|---|---|---|
| `@fe-design` | `docs/design/fe-design.md`    | Structure, state model (TanStack Query + Zustand), query-key + optimistic conventions |
| `@ui`        | `docs/UIUX/<Spec>.md` | UI/UX spec per page/component (states, interactions, navigation) |
| `@contract`  | `../contract/openapi.yaml`   | REST contract — **generates** the typed client `src/types/api.generated.ts` |
| `@events`    | `../contract/asyncapi.yaml`  | Socket-event contract — mirrored in `src/types/socket.ts` |

## Stack reminder (from `@fe-design`)
React 18 + Vite + TypeScript (strict), Tailwind (Discord tokens), React Router,
**TanStack Query** (server state), **Zustand** (UI/auth/socket state), **Socket.io-client**,
Axios (single instance + refresh interceptor), Zod (form validation). Tests: **Vitest** +
Testing Library, **Playwright** (e2e, G4 only).

## Gates (frontend)
The frontend owns **G0** (scaffold, once) and **G3** (feature UI + state). **G4** (joint
e2e against the real backend) is **optional** — run only when explicitly requested and the
backend is up; it is not part of the done bar. G1/G2 are backend gates.

---

## The four-step feature sequence (applies to every feature)

1. **Types** — confirm/regenerate the feature's slice of `api.generated.ts` from `@contract`
   (and socket types from `@events`). Run `npm run contract:types`. This locks the shapes
   before any code references them; never hand-write API types.
2. **API & state** — the feature's `api.ts` (typed calls using the generated types), its
   TanStack Query hooks, and any Zustand slice. Conventions: `@fe-design` §2.6 (query keys,
   invalidation, optimistic updates) and §2.7 (socket-event → cache mapping). The contract
   defines the shapes; `@fe-design` defines how they're managed. **No separate state doc** —
   it's these two plus the UI states in step 3.
3. **UI** — pages and components per `@ui`, wired to the hooks from step 2. Cover every state
   the spec lists (loading, empty, error, success), every interaction, every navigation path.
   Theme + shared patterns from the UI `README`.
4. **Verify** — invoke `fe-qa-reviewer`; loop (fix → re-invoke) until PASS. Fix the
   implementation, never the spec or a test, to make a check pass.

---

## Features & build order

Mirrors the backend order so a joint G4 can converge feature-by-feature when wanted.

> **First milestone (vertical slice):** Stages 1 + 4 + 5 + 6 — login → open DM → send
> (optimistic) → receive `message:new` live → reload reads history from the API. Build this
> spine before Groups / Notifications.

---

### Stage 1 — Auth
Spec: `@ui/01-login-signup.md`, `@ui/03-settings.md` (logout) · Contract domain: `auth`

1. **Types** — confirm `auth` paths in `api.generated.ts` (`signup`, `login`, `refresh`,
   `logout`, password-reset).
2. **API & state** — `features/auth/api.ts`; hooks `useLogin`, `useSignup`, `useLogout`,
   `usePasswordReset`; `authStore` slice (current user + access token) per `@fe-design` §2.6/§5.
   Wire the Axios refresh interceptor (`lib/axios.ts`) and socket-connect-on-login.
3. **UI** — `LoginPage` (login/signup tabs), `ForgotPasswordForm`, `ResetPasswordForm`,
   `GoogleOAuthButton`; all states from the spec (submitting, field errors, auth error,
   rate-limited, reset-sent).
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G0 + G3 green.

### Stage 2 — Users & Profile
Spec: `@ui/03-settings.md`, presence selector in `@ui/09-header-bar.md` · Domains: `users`

1. **Types** — `users` paths (`/users/me`, avatar, presence, search, public profile).
2. **API & state** — `features/settings/api.ts` (`useUpdateProfile`, `useChangePassword`,
   `useBlockedUsers`), `features/presence/api.ts` (`useUpdatePresence`); query key `['me']`.
3. **UI** — `SettingsPage` sections (profile, security, blocked users, logout); avatar
   uploader; `PresenceSelector` in the header profile popover.
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G3 green.

### Stage 3 — Contacts
Spec: `@ui/04-chat-list.md`, `@ui/10-find-friends-form.md` · Domain: `contacts`, `users` (search)

1. **Types** — `contacts` paths + `/users/search`.
2. **API & state** — `features/contacts/api.ts`; hooks `useContacts`, `useUserSearch`
   (debounced), `useFriendRequest`, `useRemoveFriend`, `useBlockUser`; keys
   `['contacts','friends']`, `['contacts','blocked']`, `['users','search',q]`.
3. **UI** — `ChatList` Friends/Groups tabs, `FriendRow` (presence dot, overflow menu),
   `FindFriendsModal` + `UserSearchResultRow` (relationship-aware action). All list states.
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G3 green.

### Stage 4 — Conversations
Spec: `@ui/04-chat-list.md` (sessions tab), `@ui/02-homepage.md` · Domain: `conversations`

1. **Types** — `conversations` paths (list, get, open DM, mark read).
2. **API & state** — `features/contacts/useConversations` (key `['conversations']`),
   `features/chat/api.ts` (`getConversation`, `openDm`, `markRead`); `uiStore.activeConversationId`.
3. **UI** — Chats tab session rows (preview, unread badge, sort by recent), `HomePage` shell
   + empty state; selecting a row routes to `/c/:conversationId`.
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G3 green.

### Stage 5 — Messaging
Spec: `@ui/05-chat-window.md` · Domain: `messages`

1. **Types** — `messages` paths (history, send, delete, attachments).
2. **API & state** — `features/chat/api.ts` (`fetchMessages` infinite query keyed
   `['messages',conversationId]`, `sendMessage`, `deleteMessage`); `useSendMessage`
   **optimistic** with `clientNonce` + rollback (per `@fe-design` §2.6).
3. **UI** — `ChatWindow`, `MessageHistory` (infinite scroll), `MessageBubble` +
   `MessageStatusIcon`, `MessageComposer` (Enter/Shift+Enter, `@`-mention), `TypingIndicator`,
   `EmptyChatState`, attachment preview. All states incl. blocked-DM and sending/failed.
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G3 green.

### Stage 6 — Realtime wiring
Spec: cross-cuts `@ui/04`, `@ui/05`, `@ui/09` · Contract: `@events` (asyncapi)

1. **Types** — `ServerToClientEvents` / `ClientToServerEvents` in `types/socket.ts` mirror `@events`.
2. **API & state** — `lib/socket.ts` (handshake auth), `hooks/useSocket` (connect/status →
   `socketStore`), `hooks/useSocketEvent` (typed subscribe/cleanup). Each feature hook
   subscribes to **its** events per `@fe-design` §2.7: `message:new/deleted/status`,
   `typing:*`, `presence:changed`, `notification:new`, `conversation:new`, `member:*`.
   Implement reconnect → replay by ULID cursor.
3. **UI** — `ConnectionStatusBanner` (reconnecting); live updates land in the components from
   Stages 3–5 (list bumps, live bubbles, typing, presence dots).
4. **Verify** — `fe-qa-reviewer` → PASS (socket handlers unit-tested against `@events` payloads).
   **Done:** G3 green. *(This completes the vertical-slice milestone.)*

### Stage 7 — Groups
Spec: `@ui/06-group-settings.md`, `@ui/07-invite-members.md`, `@ui/12-create-group-form.md` · Domain: `groups`

1. **Types** — `groups` paths (create, detail, update, delete, members, roles, invite link, join).
2. **API & state** — `features/groups/api.ts`; hooks `useCreateGroup`, `useGroupSettings`,
   `useInviteMembers`, `useLeaveGroup`; keys `['groups',id]`, `['groups',id,'members']`.
3. **UI** — `CreateGroupModal` + shared `MemberPicker`, `GroupSettingsModal` (profile,
   roles, danger zone), `InviteMembersModal`, `MemberRow` + `RoleBadge`. Backfill group rows
   into the Stage 4 conversation list.
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G3 green.

### Stage 8 — Notifications
Spec: `@ui/11-notification-list.md` · Domain: `notifications`

1. **Types** — `notifications` paths (list, count, seen).
2. **API & state** — `features/notifications/api.ts`; `useNotifications` (key
   `['notifications']`), `useNotificationActions` (dispatch accept/decline to contacts/groups
   APIs by type); `['notifications','count']` for the badge, live-incremented by `notification:new`.
3. **UI** — header bell + `Badge`, `NotificationList` dropdown with the item types
   (friend request, group invite, join request, generic); mark-seen on open.
4. **Verify** — `fe-qa-reviewer` → PASS. **Done:** G3 green.

---

## Definition of Done (frontend portion)
```bash
npm run gate:fe-feature   # = gate:scaffold && gate:frontend
```
A feature is done on the frontend when **G0 and G3 are green** (G3 includes the
spec-conformance review with 0 deviations). G4 is optional and not part of this bar. If any
gate check fails, fix the implementation and re-run until clean — the reviewer's PASS is the
only done signal.

## Why there is no separate "state design" doc
State design is not a standalone artifact — it is fully determined by three docs you already
have: the **contract** (what server state exists), **`@fe-design` §2.6/§2.7** (how it's
managed — query keys, invalidation, optimistic updates, socket→cache mapping), and each
**`@ui`** spec (what UI state exists — the listed loading/empty/error/success states). If a
state rule feels too thin to build from, thicken `@fe-design`, where it applies to every
feature — do not spawn a parallel doc that can drift from the contract.
