# Database Schema — `schema.prisma` (Design Draft)

> Phase 4 · Detailed Design (Data Layer). Derived from the Phase 4 ERD and the Phase 3
> API contract. This is a **design document**, not an applied schema — it captures the
> models, constraints, and indexes for review before implementation.

PostgreSQL + Prisma. Naming: Prisma models are PascalCase singular; physical tables are
snake_case plural via `@@map`. Surrogate keys are UUID v4 except `Message.id`, which is a
**ULID** (lexicographically sortable — see note 3).

---

## Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─────────────────────────── Enums ───────────────────────────

enum Presence {
  ONLINE
  AWAY
  DND
  OFFLINE
}

enum ConversationType {
  DM
  GROUP
}

enum GroupRole {
  ADMIN
  MEMBER
}

enum TokenType {
  REFRESH          // rotating; uses revokedAt + replacedById
  PASSWORD_RESET   // single-use; uses usedAt
  // OPEN DECISION: keep one Token table with this discriminator, or split into
  // RefreshToken + PasswordResetToken. Single-table chosen here for simplicity.
}

enum AttachmentKind {
  IMAGE
  FILE
}

enum RequestType {
  FRIEND_REQUEST       // groupId is null
  GROUP_INVITE         // groupId set
  GROUP_JOIN_REQUEST   // groupId set; used only if join-approval model is adopted
}

enum RequestStatus {
  PENDING
  ACCEPTED
  REJECTED
  CANCELLED
}

enum NotificationType {
  FRIEND_REQUEST
  FRIEND_REQUEST_ACCEPTED
  GROUP_INVITE
  GROUP_JOIN_REQUEST
  MENTION
  MISSED_CALL          // only if voice is in scope (UI FLAG #1)
  GENERIC
}

enum RelationType {
  FRIEND   // symmetric in meaning; stored as a directed edge (see note 5)
  BLOCK    // directional: owner blocked related
}

// ─────────────────────────── Identity ───────────────────────────

model User {
  id         String    @id @default(uuid())
  displayName String
  avatarUrl  String?
  bio        String?
  presence   Presence  @default(OFFLINE)
  lastSeenAt DateTime?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  account             Account?
  tokens              Token[]
  messages            Message[]          // as sender
  uploadedAttachments Attachment[]
  memberships         Member[]
  userChats           UserChat[]
  conversationReads   ConversationRead[]
  sentRequests        Request[]          @relation("RequestSource")
  receivedRequests    Request[]          @relation("RequestTarget")
  notifications       Notification[]     @relation("NotificationRecipient")
  actedNotifications  Notification[]     @relation("NotificationActor")
  relationsOwned      Relation[]         @relation("RelationOwner")
  relationsTargeting  Relation[]         @relation("RelationRelated")
  createdInviteLinks  GroupInviteLink[]

  @@map("users")
}

model Account {
  id           String   @id @default(uuid())
  userId       String   @unique
  username     String   @unique          // login identifier; also used by user search
  email        String   @unique
  passwordHash String?                    // null when the account is OAuth-only
  createdAt    DateTime @default(now())

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  oauthAccounts OAuthAccount[]

  @@map("accounts")
}

model OAuthAccount {
  id             String   @id @default(uuid())
  accountId      String
  provider       String                    // 'google'
  providerUserId String
  createdAt      DateTime @default(now())

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([provider, providerUserId])
  @@index([accountId])
  @@map("oauth_accounts")
}

model Token {
  id           String    @id @default(uuid())
  userId       String
  type         TokenType
  tokenHash    String    @unique           // store a hash, never the raw token
  expiresAt    DateTime
  revokedAt    DateTime?                    // refresh: revoked on logout / rotation
  usedAt       DateTime?                    // password reset: single-use marker
  replacedById String?                      // refresh rotation chain
  createdAt    DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, type])
  @@map("tokens")
}

// ─────────────────────────── Conversations & messages ───────────────────────────

model Conversation {
  id             String           @id @default(uuid())
  type           ConversationType
  lastMessageId  String?          @unique   // denormalized pointer for list previews
  lastActivityAt DateTime         @default(now())
  dmKey          String?          @unique   // canonical sorted "userA:userB"; enforces one DM per pair (note 4)
  createdAt      DateTime         @default(now())

  messages    Message[]          @relation("ConversationMessages")
  lastMessage Message?           @relation("LastMessage", fields: [lastMessageId], references: [id])
  group       Group?
  userChats   UserChat[]
  reads       ConversationRead[]

  @@index([lastActivityAt])
  @@map("conversations")
}

model Group {
  id             String   @id @default(uuid())
  conversationId String   @unique          // 1:1 — a group IS a conversation
  name           String
  description    String?
  avatarUrl      String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  conversation Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  members      Member[]
  requests     Request[]                    // invites / join requests scoped to this group
  inviteLinks  GroupInviteLink[]

  @@map("groups")
}

model Member {
  id       String    @id @default(uuid())
  userId   String
  groupId  String
  role     GroupRole @default(MEMBER)
  joinedAt DateTime  @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  group Group @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@unique([userId, groupId])               // one membership per user per group
  @@index([groupId])
  @@map("members")
}

// DM participants only (groups are reached via Member). See note 6.
model UserChat {
  id             String   @id @default(uuid())
  userId         String
  conversationId String
  joinedAt       DateTime @default(now())

  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@unique([userId, conversationId])
  @@index([conversationId])
  @@map("user_chats")
}

// Read marker per user per conversation — spans BOTH DMs and groups. Drives unread counts.
model ConversationRead {
  id                String   @id @default(uuid())
  userId            String
  conversationId    String
  lastReadMessageId String?
  lastReadAt        DateTime @default(now())

  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  lastReadMessage Message?     @relation("ReadMarker", fields: [lastReadMessageId], references: [id])

  @@unique([userId, conversationId])
  @@index([conversationId])
  @@map("conversation_reads")
}

model Message {
  /// ULID — lexicographically sortable; assigned in the app layer on create (note 3)
  id             String    @id
  conversationId String
  senderId       String
  content        String?                    // null when soft-deleted (FR-16)
  createdAt      DateTime  @default(now())
  deletedAt      DateTime?

  conversation  Conversation       @relation("ConversationMessages", fields: [conversationId], references: [id], onDelete: Cascade)
  sender        User               @relation(fields: [senderId], references: [id])
  attachments   Attachment[]
  lastMessageOf Conversation?      @relation("LastMessage")
  readMarkers   ConversationRead[] @relation("ReadMarker")

  @@index([conversationId, id])             // keyset pagination + reconnect cursor (note 3)
  @@index([senderId])
  @@map("messages")
}

model Attachment {
  id         String         @id @default(uuid())
  messageId  String?                          // null until the message is sent (upload-before-send, FR-17)
  uploaderId String
  url        String
  fileName   String
  mimeType   String
  sizeBytes  Int
  kind       AttachmentKind
  createdAt  DateTime       @default(now())

  message  Message? @relation(fields: [messageId], references: [id], onDelete: Cascade)
  uploader User     @relation(fields: [uploaderId], references: [id])

  @@index([messageId])
  @@map("attachments")
}

// ─────────────────────────── Social graph ───────────────────────────

// Unified request entity: friend requests, group invites, and join requests.
model Request {
  id           String        @id @default(uuid())
  sourceUserId String                        // initiator
  targetUserId String                        // recipient
  groupId      String?                       // null for FRIEND_REQUEST
  type         RequestType
  status       RequestStatus @default(PENDING)
  createdAt    DateTime      @default(now())
  respondedAt  DateTime?

  sourceUser   User          @relation("RequestSource", fields: [sourceUserId], references: [id], onDelete: Cascade)
  targetUser   User          @relation("RequestTarget", fields: [targetUserId], references: [id], onDelete: Cascade)
  group        Group?        @relation(fields: [groupId], references: [id], onDelete: Cascade)
  notification Notification?                 // 0..1 (note 5)

  @@index([targetUserId, status])
  @@index([sourceUserId])
  @@index([groupId])
  @@map("requests")
}

model Notification {
  id          String           @id @default(uuid())
  recipientId String
  requestId   String?          @unique        // 0..1 — set only for request-backed notifications
  actorId     String?                         // who triggered it; null for system
  type        NotificationType
  payload     Json?                           // mention target, generic text, ids, etc.
  read        Boolean          @default(false)
  createdAt   DateTime         @default(now())

  recipient User     @relation("NotificationRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  actor     User?    @relation("NotificationActor", fields: [actorId], references: [id])
  request   Request? @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([recipientId, read, createdAt])
  @@map("notifications")
}

// Directed edge. FRIEND = symmetric meaning; BLOCK = owner blocked related (note 7).
model Relation {
  id        String       @id @default(uuid())
  ownerId   String
  relatedId String
  type      RelationType
  createdAt DateTime     @default(now())

  owner   User @relation("RelationOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  related User @relation("RelationRelated", fields: [relatedId], references: [id], onDelete: Cascade)

  @@unique([ownerId, relatedId, type])
  @@index([relatedId, type])                 // reverse lookups: "who blocked me", friends-of
  @@map("relations")
}

model GroupInviteLink {
  id          String    @id @default(uuid())
  groupId     String
  token       String    @unique
  createdById String
  expiresAt   DateTime?
  maxUses     Int?
  useCount    Int       @default(0)
  createdAt   DateTime  @default(now())

  group     Group @relation(fields: [groupId], references: [id], onDelete: Cascade)
  createdBy User  @relation(fields: [createdById], references: [id])

  @@index([groupId])
  @@map("group_invite_links")
}
```

---

## Constraints & indexes — why each exists

1. `Account.userId @unique` enforces the 1:1 with `User`; `username`/`email` unique back
   the login + search lookups (FR-01, FR-05).
2. `OAuthAccount @@unique([provider, providerUserId])` — one Google identity maps to one
   account (FR-02).
3. `Member @@unique([userId, groupId])` — no duplicate memberships; `role` lives here for
   FR-18/20/21 authorization.
4. `UserChat`/`ConversationRead @@unique([userId, conversationId])` — one row per
   user-conversation; `ConversationRead` is the source of unread counts (FR-14).
5. `Group.conversationId @unique` — the 1:1 that replaces the old `GroupChats` junction.
6. `Conversation.dmKey @unique` — see note 4; the partial-unique trick for "one DM per pair".
7. `Relation @@unique([ownerId, relatedId, type])` + reverse index — fast friend/block
   checks in both directions (FR-06/08/09), reused by the cross-cutting block guard.
8. `Message @@index([conversationId, id])` — the hot path: keyset pagination of history
   and the reconnect-replay cursor (note 3).
9. `Notification.requestId @unique` — the relaxed 1:0..1 to `Request` (note 5);
   `@@index([recipientId, read, createdAt])` powers the feed + unread badge (FR-30).
10. `Token.tokenHash @unique` + `@@index([userId, type])` — revoke-on-logout and reset
    lookups (FR-03/04); tokens are stored hashed, never raw.

---

## Design notes

1. **`Account` vs `User`.** `User` is profile (display name, avatar, bio, presence);
   `Account` holds credentials (username, email, password hash). `username` sits on
   `Account` because it is a login identifier; user search joins through it.

2. **`Token` is one table with a `type` discriminator.** Refresh tokens use
   `revokedAt` + `replacedById` (rotation); reset tokens use `usedAt` (single use). Open
   decision: split into two tables if the shared shape feels overloaded.

3. **`Message.id` is a ULID, not a sequence column.** This is the resolution of the
   "order by timestamp" question: the id is monotonic and lexicographically sortable, so
   `ORDER BY id` (or `(createdAt, id)`) is deterministic even on same-millisecond ties,
   and the id doubles as the reconnect-replay cursor. No separate `sequence` column is
   needed. The id is generated in the application layer on create (hence no `@default`).

4. **One DM per user pair** can't be expressed as a composite unique across the
   `UserChat` junction. `Conversation.dmKey` (a canonical, sorted `"<userA>:<userB>"`
   string, unique) enforces it cheaply at insert time; it stays null for group
   conversations.

5. **`Notification` is decoupled from `Request` (0..1).** Request-backed notifications
   link via the unique `requestId`; mention / accepted / generic / missed-call
   notifications have no request and carry their data in `payload`. This is the relaxation
   of the strict 1:1 idea so non-request notifications have a home.

6. **`UserChat` is DM-only; groups are reached via `Member`.** `ConversationRead` spans
   all conversations. Note the overlap: a DM participant appears in both `UserChat` and
   `ConversationRead`. If you'd rather, `ConversationRead` can absorb DM participation and
   `UserChat` is dropped — the two-table split is kept here as specified.

7. **`Relation` stores directed edges.** A `BLOCK` is one row (`owner` blocked `related`).
   A `FRIEND` is symmetric in meaning; store it either as one row interpreted both ways or
   as two reciprocal rows — pick one convention and apply it consistently in the service
   layer. The reverse index supports "who blocked me" / "friends of" queries.

8. **GDPR deletion (privacy NFR).** `Message.sender` intentionally has **no** cascade, so
   deleting a user won't silently erase shared history. Account deletion should be handled
   in the service layer (anonymize sender, purge `Account`/`Token`/`OAuthAccount`,
   tombstone messages) rather than a blanket `onDelete: Cascade`.

---

## Open decisions still to settle (carried from Phase 3)

- **Token table**: single + discriminator (drafted) vs split tables.
- **Last-admin rule** on `Member`: block leave vs auto-promote — affects FR-20/22 logic,
  not the schema shape.
- **Group join model**: if direct-add only, `RequestType.GROUP_JOIN_REQUEST` and the
  related notification type go unused and can be dropped.
- **Friendship storage**: one symmetric row vs two reciprocal rows (note 7).

These are logic/representation choices; none changes the table set above except possibly
dropping the unused `GROUP_JOIN_REQUEST` enum value.
