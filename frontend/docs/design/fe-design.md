# Frontend Design Document

> Phase 4 · Detailed Design (Frontend Architecture)
> Builds on the Phase 2 tech-stack decisions and the Phase 2 UI/UX wireframe specs.

---

## 1. Language stack

### Core

| Tool | Version | Role |
|---|---|---|
| **TypeScript** | 5.x (strict) | Primary language. All source files are `.tsx` / `.ts`. Strict mode enforced. |
| **React** | 18.x | UI framework. Concurrent features used (Suspense, transitions). |
| **Vite** | 5.x | Build tool and dev server. Fast HMR, ES module native. |

### Styling

| Tool | Version | Role |
|---|---|---|
| **Tailwind CSS** | 3.x | Utility-first styling. Theme tokens configured in `tailwind.config.ts` (colors, spacing, radius, dark mode). |
| **clsx / tailwind-merge** | latest | Safe conditional class composition; resolves Tailwind class conflicts. |

### Routing

| Tool | Version | Role |
|---|---|---|
| **React Router** | 6.x | File-system-independent declarative routing. Provides protected routes, nested layouts, and deep-link support for open conversations. |

### State management

| Tool | Version | Role |
|---|---|---|
| **TanStack Query (React Query)** | 5.x | **Server state**: all async data that originates from the API (conversations, messages, contacts, groups, notifications). Handles caching, deduplication, background refetch, optimistic updates. |
| **Zustand** | 4.x | **Client/UI state**: synchronous state that does not live on the server (active conversation id, open modal, current user session, presence status). Small stores; no boilerplate. |

### Realtime

| Tool | Version | Role |
|---|---|---|
| **Socket.io-client** | 4.x | WebSocket connection to the backend Socket.io server. Realtime messages, typing indicators, presence, delivery receipts, notifications. |

### HTTP & Validation

| Tool | Version | Role |
|---|---|---|
| **Axios** | 1.x | HTTP client. Configured instance with base URL, auth headers, and a response interceptor for transparent access-token refresh. |
| **Zod** | 3.x | Runtime schema validation for form inputs and API response shapes. Shared schema types generated with `z.infer<>`. |

### Tooling & testing

| Tool | Version | Role |
|---|---|---|
| **ESLint** | 8.x | Lint with `@typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-import`. |
| **Prettier** | 3.x | Auto-format. Consistent with backend formatting rules. |
| **Vitest** | 1.x | Unit + integration tests. Same config as Vite, no extra setup. |
| **Playwright** | 1.x | End-to-end tests (e2e/). Tests core flows: auth, send message, create group. |
| **Pino (browser build)** | 8.x | Structured log events from the client (errors, socket events). |

---

## 2. Project structure

### Philosophy — feature-based vertical slices

Code is organized by **feature** (auth, chat, contacts, groups…), not by type (all
components in one folder, all hooks in another). Each feature owns its components,
hooks, and API calls. Shared atoms live in `components/ui/`. This keeps related code
co-located and prevents a flat components/ folder with hundreds of files.

```
chat-app/
├── public/
│   └── favicon.ico
│
├── e2e/                            # Playwright end-to-end tests
│   ├── auth.spec.ts
│   ├── chat.spec.ts
│   └── groups.spec.ts
│
├── src/
│   ├── main.tsx                    # React.createRoot entry point
│   ├── App.tsx                     # Router mount + global providers
│   │
│   ├── assets/                     # Static: images, SVG icons, fonts
│   │
│   ├── styles/
│   │   └── globals.css             # Tailwind base/components/utilities directives;
│   │                               # CSS variable overrides for theme tokens
│   │
│   ├── router/
│   │   ├── index.tsx               # Route tree (see §2.5)
│   │   └── ProtectedRoute.tsx      # Redirects unauthenticated users to /login
│   │
│   ├── lib/                        # Third-party client setup (instantiated once)
│   │   ├── axios.ts                # Configured Axios instance + interceptors
│   │   ├── queryClient.ts          # TanStack Query client (staleTime, retry config)
│   │   └── socket.ts               # Socket.io client instance + connect/disconnect
│   │
│   ├── types/                      # Shared TypeScript types (no logic)
│   │   ├── entities.ts             # User, Message, Conversation, Group, Notification…
│   │   ├── api.ts                  # Generic API envelope types (PaginatedResponse, etc.)
│   │   └── socket.ts               # Socket event name → payload type map
│   │
│   ├── utils/                      # Pure functions, no React
│   │   ├── formatDate.ts           # Relative timestamps ("2 min ago")
│   │   ├── cn.ts                   # clsx + twMerge wrapper
│   │   └── assert.ts               # Dev-only assertion helper
│   │
│   ├── store/                      # Zustand stores
│   │   ├── authStore.ts            # currentUser, accessToken, isAuthenticated
│   │   ├── uiStore.ts              # activeConversationId, openModal, sidebarTab
│   │   └── socketStore.ts          # connectionStatus: 'connected'|'reconnecting'|'disconnected'
│   │
│   ├── hooks/                      # Global hooks (cross-feature or app-level)
│   │   ├── useSocket.ts            # Connects socket on mount, exposes status
│   │   ├── useSocketEvent.ts       # Generic typed socket event listener
│   │   ├── useAuth.ts              # Reads authStore; exposes user + isAuthenticated
│   │   └── useToast.ts             # Trigger toast notifications (wraps a toast lib)
│   │
│   ├── components/
│   │   ├── ui/                     # Design system atoms — see §2.3
│   │   └── shared/                 # Composite components used across features — see §2.4
│   │
│   ├── features/                   # Feature modules — see §2.2
│   │   ├── auth/
│   │   ├── chat/
│   │   ├── contacts/
│   │   ├── groups/
│   │   ├── notifications/
│   │   ├── presence/
│   │   └── settings/
│   │
│   ├── layouts/
│   │   ├── AppLayout.tsx           # Authenticated shell: Header + ChatList + <Outlet>
│   │   └── AuthLayout.tsx          # Unauthenticated shell: centered card on bg
│   │
│   └── pages/                      # Route-level thin wrappers — see §2.5
│       ├── LoginPage.tsx
│       ├── HomePage.tsx
│       ├── ResetPasswordPage.tsx
│       └── SettingsPage.tsx
│
├── .env.example
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

### 2.2 Feature modules

Each feature follows the same internal shape:

```
features/<feature>/
├── components/     # React components private to this feature
├── hooks/          # React hooks private to this feature
├── api.ts          # All API calls for this feature (returns typed promises)
├── schemas.ts      # Zod schemas for forms and API responses (optional)
└── index.ts        # Public re-exports (what other features may import)
```

#### features/auth/

| File | Contents |
|---|---|
| `components/LoginForm.tsx` | Username + password form. |
| `components/SignupForm.tsx` | Username, email, password, confirm, consent. |
| `components/ForgotPasswordForm.tsx` | Email field → request reset link. |
| `components/ResetPasswordForm.tsx` | New password + confirm (used on `/reset-password?token=`). |
| `components/GoogleOAuthButton.tsx` | "Continue with Google" trigger. |
| `hooks/useLogin.ts` | Mutation: POST login → store token → navigate. |
| `hooks/useSignup.ts` | Mutation: POST signup → auto-login. |
| `hooks/useLogout.ts` | Mutation: POST logout → clear stores → navigate to /login. |
| `hooks/usePasswordReset.ts` | Mutations: request + confirm. |
| `api.ts` | `login()`, `signup()`, `logout()`, `requestPasswordReset()`, `confirmPasswordReset()`, `googleOAuthCallback()` |
| `schemas.ts` | Zod: `loginSchema`, `signupSchema`, `resetSchema`. |

#### features/chat/

| File | Contents |
|---|---|
| `components/ChatWindow.tsx` | Top-level: header + history + composer. Orchestrates the rest. |
| `components/ChatHeader.tsx` | Contextual: avatar, name, action buttons (call, invite, overflow). |
| `components/MessageHistory.tsx` | Virtualized list of `MessageBubble`; infinite scroll upward. |
| `components/MessageBubble.tsx` | Single message row: avatar, text, timestamp, status, hover menu. |
| `components/MessageStatusIcon.tsx` | Sending / Sent / Delivered / Read indicators (FR-14). |
| `components/TypingIndicator.tsx` | Animated "<name> is typing…" (FR-15). |
| `components/MessageComposer.tsx` | Text input, attachment button (P3), send button. |
| `components/AttachmentPreview.tsx` | Pending attachment chips with remove (P3). |
| `components/EmptyChatState.tsx` | "Start of your conversation with <name>." |
| `hooks/useMessages.ts` | Paginated query for message history; appends incoming via socket. |
| `hooks/useSendMessage.ts` | Optimistic mutation; rolls back on failure. |
| `hooks/useDeleteMessage.ts` | Soft-delete mutation (FR-16). |
| `hooks/useTyping.ts` | Debounced emit of typing events; listens for partner typing (FR-15). |
| `hooks/useReadReceipts.ts` | Emits read events when conversation is viewed; updates message status (FR-14). |
| `api.ts` | `fetchMessages()`, `sendMessage()`, `deleteMessage()`, `markRead()` |

#### features/contacts/

| File | Contents |
|---|---|
| `components/ChatList.tsx` | Left column: action buttons + tabs + active tab content. |
| `components/ChatSessionRow.tsx` | A row in the "Chats" tab (preview, unread badge). |
| `components/FriendRow.tsx` | A row in the "Friends" section (presence dot, overflow menu). |
| `components/GroupRow.tsx` | A row in the "Groups" section (icon, leave menu). |
| `components/FindFriendsModal.tsx` | Modal: search bar + results list (FR-05). |
| `components/UserSearchResultRow.tsx` | A user result row with relationship-aware action. |
| `hooks/useConversations.ts` | Query for all active chat sessions (sorted by recent). |
| `hooks/useContacts.ts` | Query for friends list (with presence). |
| `hooks/useUserSearch.ts` | Debounced query for user search (global, FR-05). |
| `hooks/useFriendRequest.ts` | Send / accept / decline mutations (FR-06). |
| `hooks/useRemoveFriend.ts` | Remove contact mutation (FR-07). |
| `hooks/useBlockUser.ts` | Block / unblock mutations (FR-08, FR-09). |
| `api.ts` | `searchUsers()`, `sendFriendRequest()`, `acceptRequest()`, `declineRequest()`, `removeFriend()`, `blockUser()`, `unblockUser()`, `fetchConversations()`, `fetchFriends()` |

#### features/groups/

| File | Contents |
|---|---|
| `components/CreateGroupModal.tsx` | Form: icon, name, MemberPicker, create button (FR-18). |
| `components/GroupSettingsModal.tsx` | Tabbed: profile edit, members/roles, danger zone (FR-20–23). |
| `components/InviteMembersModal.tsx` | MemberPicker + invite link (FR-19). |
| `components/MemberRow.tsx` | Group member row: avatar, name, role badge, action menu. |
| `hooks/useCreateGroup.ts` | Mutation: create group + navigate to it. |
| `hooks/useGroupSettings.ts` | Query + mutations for group metadata, members, roles. |
| `hooks/useInviteMembers.ts` | Mutation: send invites + generate/copy link. |
| `hooks/useLeaveGroup.ts` | Mutation (FR-22): confirm → leave → navigate home. |
| `api.ts` | `createGroup()`, `updateGroup()`, `deleteGroup()`, `fetchGroup()`, `inviteMembers()`, `generateInviteLink()`, `removeMember()`, `changeRole()`, `leaveGroup()` |

#### features/notifications/

| File | Contents |
|---|---|
| `components/NotificationList.tsx` | Dropdown list: loading / empty / error / items. |
| `components/FriendRequestItem.tsx` | Accept + Decline actions (FR-06). |
| `components/GroupInviteItem.tsx` | Accept + Decline (FR-19). |
| `components/JoinRequestItem.tsx` | Admin-only accept/decline for group join requests. |
| `components/GenericNotificationItem.tsx` | Mention, missed-call, generic info (FR-30). |
| `hooks/useNotifications.ts` | Query; marks seen on mount; paginates. |
| `hooks/useNotificationActions.ts` | Mutations: accept/decline for all types. |
| `api.ts` | `fetchNotifications()`, `markSeen()`, `acceptFriendRequest()`, `declineFriendRequest()`, `acceptGroupInvite()`, `declineGroupInvite()`, `acceptJoinRequest()`, `declineJoinRequest()` |

#### features/presence/

| File | Contents |
|---|---|
| `components/PresenceSelector.tsx` | Status picker in profile popover (Online/Away/DND/Offline). |
| `hooks/usePresence.ts` | Query for a specific user's presence. |
| `hooks/useUpdatePresence.ts` | Mutation: update own status → writes to `store/presenceStore`. |
| `hooks/usePresenceFeed.ts` | Listens for `presence:changed` socket events; updates contacts list. |
| `api.ts` | `updatePresence()` |

#### features/settings/

| File | Contents |
|---|---|
| `components/ProfileSection.tsx` | Avatar uploader, display name, username, bio (FR-11). |
| `components/SecuritySection.tsx` | Change password / reset + connected accounts (FR-04). |
| `components/BlockedUsersSection.tsx` | Blocked list + Unblock per row (FR-09). |
| `components/LogoutButton.tsx` | Styled destructive button (FR-03). |
| `hooks/useUpdateProfile.ts` | Mutation: PATCH profile. |
| `hooks/useChangePassword.ts` | Mutation: POST change-password. |
| `hooks/useBlockedUsers.ts` | Query for blocked list + unblock mutation. |
| `api.ts` | `updateProfile()`, `uploadAvatar()`, `changePassword()`, `fetchBlockedUsers()`, `unblockUser()` |

---

### 2.3 Design system — `components/ui/`

Primitive, headless-style atoms consumed everywhere. No business logic.

| Component | Description |
|---|---|
| `Button` | Variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`. Loading/disabled states. |
| `IconButton` | Square button wrapping an icon. `aria-label` required. |
| `Input` | Text input with label, helper text, error state, leading/trailing slot. |
| `Textarea` | Resizing textarea with char counter slot. |
| `Avatar` | Circular. Props: `src`, `name` (generates initials + color). `size`: `sm / md / lg`. |
| `Badge` | Count badge. Auto-hides at zero. Caps at `9+`. |
| `Modal` | Overlay + centered panel. Manages focus trap, Esc close, backdrop click. |
| `ModalHeader` | Title + close button. |
| `ConfirmDialog` | Wraps Modal. Destructive action double-confirm. |
| `Overlay` | Dimmed backdrop (reused by Modal, popovers). |
| `Tabs` | Controlled tab switcher. Minimal styling. |
| `Chip` | Removable tag (for selected-member lists). |
| `Skeleton` | Animated placeholder. Matches common row shapes. |
| `Spinner` | Small inline loading indicator. |
| `Toast` | Ephemeral message (success / error / info). Stacks; auto-dismisses. |
| `DropdownMenu` | Anchored menu (overflow ⋯ menus). Item variants: default, danger. |
| `Tooltip` | Accessible hover tooltip. |
| `Popover` | Anchored floating panel (profile popup, notification dropdown). |

---

### 2.4 Shared composite components — `components/shared/`

Reusable cross-feature components that are more than atoms but not feature-specific.

| Component | Description |
|---|---|
| `PresenceDot` | Colored dot (online/away/dnd/offline). Positioned on avatars. |
| `UserAvatarWithPresence` | `Avatar` + `PresenceDot` composite. |
| `MemberPicker` | Search-bar + results list + selected-chips. **Shared** between `CreateGroupModal` and `InviteMembersModal` to avoid duplication. Props: `scope: 'friends' \| 'all'`, `excludeIds`, `value`, `onChange`. |
| `UnreadBadge` | Unread count chip displayed on chat list rows. |
| `MessageTimestamp` | Relative timestamp (e.g. "2 min ago") with absolute on hover/title. |
| `RoleBadge` | "Admin" / "Member" pill for group member rows. |
| `ConnectionStatusBanner` | Slim top banner: "Reconnecting…" when socket is disconnected. |

---

### 2.5 Pages and routing

#### Route tree (`router/index.tsx`)

```
/                          ← redirect → /c (or empty home)
/login                     ← LoginPage     (unauthenticated)
/signup                    ← LoginPage     (unauthenticated, sign-up tab active)
/reset-password            ← ResetPasswordPage (unauthenticated; uses ?token=)
├── (authenticated — wrapped in ProtectedRoute + AppLayout)
│   /c                     ← HomePage, no conversation selected (empty state)
│   /c/:conversationId     ← HomePage, with active conversation
│   /settings              ← SettingsPage
```

- `ProtectedRoute` checks `authStore.isAuthenticated`. If false, redirects to `/login` preserving the original `?next=` path.
- The reverse redirect: if authenticated user visits `/login`, redirect to `/c`.
- `AppLayout` is the authenticated shell. It renders `<HeaderBar />`, `<ChatList />`, and `<Outlet />` (the middle region).
- Conversation state is a **route param** (`/c/:conversationId`) so tabs and page refreshes restore the open chat.

#### Pages

| Page | Route | Responsibility |
|---|---|---|
| `LoginPage` | `/login`, `/signup` | Renders `AuthLayout` + `auth` feature forms. Reads URL to set active tab (login vs sign-up). |
| `ResetPasswordPage` | `/reset-password` | Renders `AuthLayout` + `ResetPasswordForm`. Reads `?token=` from URL. |
| `HomePage` | `/c`, `/c/:conversationId` | Renders `AppLayout`. Reads `conversationId` param; passes to `ChatWindow`. Handles empty state. |
| `SettingsPage` | `/settings` | Renders `AppLayout` (or its own layout). Mounts all settings sections. |

Pages are thin. Their only job is to glue the layout and feature components together.

---

### 2.6 State management breakdown

#### TanStack Query — server state

Query keys follow a hierarchical convention so invalidations are precise:

| Data | Query key |
|---|---|
| Conversation list | `['conversations']` |
| Single conversation | `['conversations', conversationId]` |
| Message history | `['messages', conversationId]` |
| Friends list | `['contacts', 'friends']` |
| User search | `['users', 'search', query]` |
| Group detail | `['groups', groupId]` |
| Group members | `['groups', groupId, 'members']` |
| Notifications | `['notifications']` |
| Notification count | `['notifications', 'count']` |
| Current user profile | `['me']` |
| Blocked users | `['contacts', 'blocked']` |

Mutations **invalidate** the relevant query key on success (e.g. sending a friend request invalidates `['contacts', 'friends']`).

**Optimistic updates** are used for: sending a message (append immediately, rollback on error), message delete (remove immediately), presence change (update immediately in local store).

#### Zustand stores

```typescript
// authStore
{
  currentUser: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser(user: User, token: string): void;
  clear(): void;
}

// uiStore
{
  activeConversationId: string | null;
  setActiveConversation(id: string | null): void;
  openModal: { type: ModalType; props: unknown } | null;
  openModal(type: ModalType, props?: unknown): void;
  closeModal(): void;
  sidebarTab: 'chats' | 'friends';
  setSidebarTab(tab: 'chats' | 'friends'): void;
}

// socketStore
{
  status: 'connected' | 'reconnecting' | 'disconnected';
  setStatus(status: SocketStatus): void;
}
```

Zustand state is stored in memory; `authStore` is additionally persisted to `localStorage` (access token + user id only, not the full user object) so sessions survive refresh. Sensitive data stays out of storage.

---

### 2.7 Realtime architecture (Socket.io-client)

The socket instance is created in `lib/socket.ts`, connected once on authenticated app mount via `useSocket.ts`, and disconnected on logout.

Feature hooks subscribe to events using the generic `useSocketEvent(event, handler)` hook, which attaches and cleans up the listener inside a `useEffect`.

#### Key incoming events and their handlers

| Event | Handler location | Action |
|---|---|---|
| `message:new` | `features/chat/hooks/useMessages.ts` | Append to TanStack Query cache for that conversation. Bump conversation to top of list. |
| `message:deleted` | `features/chat/hooks/useMessages.ts` | Patch message in cache to soft-deleted state. |
| `message:status` | `features/chat/hooks/useReadReceipts.ts` | Update individual message's delivery status in cache. |
| `typing:start` / `typing:stop` | `features/chat/hooks/useTyping.ts` | Update local typing state for the current conversation. |
| `presence:changed` | `features/presence/hooks/usePresenceFeed.ts` | Update friends-list cache entry for that user's presence. |
| `notification:new` | `features/notifications/hooks/useNotifications.ts` | Prepend to notifications cache; increment notification count. |
| `conversation:new` | `features/contacts/hooks/useConversations.ts` | Add new conversation to list (e.g. accepted DM). |
| `group:updated` | `features/groups/hooks/useGroupSettings.ts` | Invalidate group query. |
| `member:removed` | `features/groups/hooks/useGroupSettings.ts` | If self was removed, close conversation + show toast. |

#### Reconnection and missed-message replay

On reconnect, the client sends the last received message sequence ID (stored in
memory or TanStack Query cache). The server replays any missed messages since that
cursor (reliability NFR). `useSocket.ts` handles the reconnect event and triggers
a query refetch for the active conversation and notification count.

---

### 2.8 HTTP client (`lib/axios.ts`)

```typescript
// Single configured instance used by all feature api.ts files
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,         // sends httpOnly refresh-token cookie
});

// Request interceptor: attach access token from authStore
api.interceptors.request.use(config => {
  const token = authStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor: transparent token refresh on 401
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true;
      const newToken = await refreshAccessToken();   // POST /auth/refresh
      authStore.getState().setToken(newToken);
      error.config.headers.Authorization = `Bearer ${newToken}`;
      return api(error.config);
    }
    return Promise.reject(error);
  }
);
```

All feature `api.ts` files import this instance — never `axios` directly.

---

### 2.9 Environment variables

```bash
# .env.example
VITE_API_URL=http://localhost:4000/api
VITE_SOCKET_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

All variables are prefixed `VITE_` (Vite's requirement for client exposure).
The backend URL and socket URL are the same origin in production (Nginx proxies both);
they may differ in local development.

---

### 2.10 Key conventions

- **No default exports** except pages and layouts. Feature components and hooks use
  named exports for discoverability and refactor safety.
- **No barrel `index.ts` inside `features/`** except for the public re-export.
  Avoid deep implicit imports.
- **Co-location**: if a component is used by only one feature, it lives inside that
  feature. Move to `components/shared/` only when a second feature needs it.
- **Strict TypeScript**: `noImplicitAny`, `strictNullChecks`, `exactOptionalPropertyTypes`.
  Never `any`; use `unknown` + Zod parse at API boundaries.
- **Tailwind only** — no inline `style` props for layout/spacing/color. Theme tokens
  in `tailwind.config.ts` are the single source of truth for palette and spacing.
- **Accessibility**: every interactive element has an accessible label. Modals trap
  focus. Color is never the only means of conveying information (e.g. presence dot
  always has a `title` or visually-hidden label).