// src/types/api.ts
// Clean, hand-friendly aliases derived from the generated contract client.
// Do NOT hand-write request/response shapes here — always source them from
// `api.generated.ts` (regenerated from docs/contract/*.openapi.yaml).
import type { components, operations } from './api.generated';

// ── Shared entities ─────────────────────────────────────────────
export type SelfUser = components['schemas']['SelfUser'];
export type PublicUser = components['schemas']['PublicUser'];
export type Presence = components['schemas']['Presence'];
export type Relationship = components['schemas']['Relationship'];
export type UserSearchResult = components['schemas']['UserSearchResult'];

// ── Error envelope ──────────────────────────────────────────────
export type ApiError = components['schemas']['ApiError'];

// ── Users: profile, avatar, presence (FR-10, FR-11) ─────────────
export type UpdateProfileRequest =
  operations['updateProfile']['requestBody']['content']['application/json'];
export type AvatarUploadResponse =
  operations['uploadAvatar']['responses']['200']['content']['application/json'];
export type SetPresenceRequest =
  operations['setPresence']['requestBody']['content']['application/json'];
/** Settable presence statuses ('offline' is socket-driven, never set here). */
export type SettablePresence = SetPresenceRequest['status'];
export type SetPresenceResponse =
  operations['setPresence']['responses']['200']['content']['application/json'];

// ── Contacts: friends & requests (FR-06–09) ─────────────────────
export type ContactRequest = components['schemas']['ContactRequest'];
export type FriendsListResponse =
  operations['listFriends']['responses']['200']['content']['application/json'];
export type ContactRequestsResponse =
  operations['listContactRequests']['responses']['200']['content']['application/json'];
export type SendFriendRequestBody =
  operations['sendFriendRequest']['requestBody']['content']['application/json'];
export type SendFriendRequestResponse =
  operations['sendFriendRequest']['responses']['201']['content']['application/json'];
export type AcceptFriendRequestResponse =
  operations['acceptFriendRequest']['responses']['200']['content']['application/json'];
export type BlockUserBody =
  operations['blockUser']['requestBody']['content']['application/json'];
export type BlockUserResponse =
  operations['blockUser']['responses']['201']['content']['application/json'];
export type BlockedUsersResponse =
  operations['listBlocked']['responses']['200']['content']['application/json'];
export type UserSearchResponse =
  operations['searchUsers']['responses']['200']['content']['application/json'];

// ── Auth: password reset request (FR-04, surfaced in Settings) ──
export type PasswordResetRequest =
  operations['requestPasswordReset']['requestBody']['content']['application/json'];

// ── Auth: login ─────────────────────────────────────────────────
export type LoginRequest =
  operations['login']['requestBody']['content']['application/json'];
export type LoginResponse =
  operations['login']['responses']['200']['content']['application/json'];

// ── Auth: signup ────────────────────────────────────────────────
export type SignupRequest =
  operations['signup']['requestBody']['content']['application/json'];
export type SignupResponse =
  operations['signup']['responses']['201']['content']['application/json'];

// ── Auth: refresh ───────────────────────────────────────────────
export type RefreshResponse =
  operations['refresh']['responses']['200']['content']['application/json'];

// ── Conversations (FR-12) ────────────────────────────────────────
export type ConversationBase = components['schemas']['ConversationBase'];
export type DmConversation = components['schemas']['DmConversation'];
export type GroupConversation = components['schemas']['GroupConversation'];
export type Conversation = components['schemas']['Conversation'];
export type ListConversationsResponse =
  operations['listConversations']['responses']['200']['content']['application/json'];
export type OpenDmResponse =
  operations['openDm']['responses']['200']['content']['application/json'];
export type GetConversationResponse =
  operations['getConversation']['responses']['200']['content']['application/json'];

// ── Messages (FR-13, FR-14, FR-16, FR-17) ────────────────────────
export type ApiMessage = components['schemas']['Message'];
export type Attachment = components['schemas']['Attachment'];
export type ApiMessageStatus = components['schemas']['MessageStatus'];
export type MessagesListResponse =
  operations['listMessages']['responses']['200']['content']['application/json'];
export type SendMessageRequest =
  operations['sendMessage']['requestBody']['content']['application/json'];
export type SendMessageResponse =
  operations['sendMessage']['responses']['201']['content']['application/json'];

// ── Groups (FR-18–23) ────────────────────────────────────────────
export type GroupRole = components['schemas']['GroupRole'];
export type Group = components['schemas']['Group'];
export type ApiGroupMember = components['schemas']['GroupMember'];
export type CreateGroupRequest =
  operations['createGroup']['requestBody']['content']['application/json'];
export type CreateGroupResponse =
  operations['createGroup']['responses']['201']['content']['application/json'];
export type GetGroupResponse =
  operations['getGroup']['responses']['200']['content']['application/json'];
export type UpdateGroupRequest =
  operations['updateGroup']['requestBody']['content']['application/json'];
export type UpdateGroupResponse =
  operations['updateGroup']['responses']['200']['content']['application/json'];
export type ListGroupMembersResponse =
  operations['listGroupMembers']['responses']['200']['content']['application/json'];
export type AddGroupMembersRequest =
  operations['addGroupMembers']['requestBody']['content']['application/json'];
export type AddGroupMembersResponse =
  operations['addGroupMembers']['responses']['201']['content']['application/json'];
export type ChangeMemberRoleRequest =
  operations['changeMemberRole']['requestBody']['content']['application/json'];
export type ChangeMemberRoleResponse =
  operations['changeMemberRole']['responses']['200']['content']['application/json'];
export type CreateInviteLinkResponse =
  operations['createInviteLink']['responses']['201']['content']['application/json'];
export type GroupAvatarUploadResponse =
  operations['uploadGroupAvatar']['responses']['200']['content']['application/json'];
export type AcceptGroupInviteResponse =
  operations['acceptGroupInvite']['responses']['200']['content']['application/json'];

// ── Notifications (FR-30) ────────────────────────────────────────
export type ApiNotification = components['schemas']['Notification'];
export type NotificationType = components['schemas']['NotificationType'];
export type NotificationPayload = components['schemas']['NotificationPayload'];
export type NotificationsListResponse =
  operations['listNotifications']['responses']['200']['content']['application/json'];
export type NotificationCountResponse =
  operations['getNotificationCount']['responses']['200']['content']['application/json'];
export type MarkNotificationsSeenRequest = NonNullable<
  operations['markNotificationsSeen']['requestBody']
>['content']['application/json'];
