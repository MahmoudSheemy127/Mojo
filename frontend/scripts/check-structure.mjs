// scripts/check-structure.mjs
import { existsSync } from 'fs';

const required = [
  // Root config
  'index.html',
  'vite.config.ts',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.js',
  'playwright.config.ts',
  '.env.example',

  // Source entry points
  'src/main.tsx',
  'src/App.tsx',
  'src/test-setup.ts',
  'src/styles/globals.css',

  // Router
  'src/router/index.tsx',
  'src/router/ProtectedRoute.tsx',

  // Lib
  'src/lib/axios.ts',
  'src/lib/queryClient.ts',
  'src/lib/socket.ts',

  // Types
  'src/types/entities.ts',
  'src/types/api.ts',
  'src/types/socket.ts',

  // Utils
  'src/utils/formatDate.ts',
  'src/utils/cn.ts',
  'src/utils/assert.ts',

  // Stores
  'src/store/authStore.ts',
  'src/store/uiStore.ts',
  'src/store/socketStore.ts',

  // Global hooks
  'src/hooks/useSocket.ts',
  'src/hooks/useSocketEvent.ts',
  'src/hooks/useAuth.ts',
  'src/hooks/useToast.ts',

  // UI atoms
  'src/components/ui/Button.tsx',
  'src/components/ui/IconButton.tsx',
  'src/components/ui/Input.tsx',
  'src/components/ui/Textarea.tsx',
  'src/components/ui/Avatar.tsx',
  'src/components/ui/Badge.tsx',
  'src/components/ui/Modal.tsx',
  'src/components/ui/ModalHeader.tsx',
  'src/components/ui/ConfirmDialog.tsx',
  'src/components/ui/Overlay.tsx',
  'src/components/ui/Tabs.tsx',
  'src/components/ui/Chip.tsx',
  'src/components/ui/Skeleton.tsx',
  'src/components/ui/Spinner.tsx',
  'src/components/ui/Toast.tsx',
  'src/components/ui/DropdownMenu.tsx',
  'src/components/ui/Tooltip.tsx',
  'src/components/ui/Popover.tsx',

  // Shared composites
  'src/components/shared/PresenceDot.tsx',
  'src/components/shared/UserAvatarWithPresence.tsx',
  'src/components/shared/MemberPicker.tsx',
  'src/components/shared/UnreadBadge.tsx',
  'src/components/shared/MessageTimestamp.tsx',
  'src/components/shared/RoleBadge.tsx',
  'src/components/shared/ConnectionStatusBanner.tsx',

  // Layouts
  'src/layouts/AppLayout.tsx',
  'src/layouts/AuthLayout.tsx',

  // Pages
  'src/pages/LoginPage.tsx',
  'src/pages/HomePage.tsx',
  'src/pages/ResetPasswordPage.tsx',
  'src/pages/SettingsPage.tsx',

  // Feature: auth
  'src/features/auth/components/LoginForm.tsx',
  'src/features/auth/components/SignupForm.tsx',
  'src/features/auth/components/ForgotPasswordForm.tsx',
  'src/features/auth/components/ResetPasswordForm.tsx',
  'src/features/auth/components/GoogleOAuthButton.tsx',
  'src/features/auth/hooks/useLogin.ts',
  'src/features/auth/hooks/useSignup.ts',
  'src/features/auth/hooks/useLogout.ts',
  'src/features/auth/hooks/usePasswordReset.ts',
  'src/features/auth/api.ts',
  'src/features/auth/schemas.ts',
  'src/features/auth/index.ts',

  // Feature: chat
  'src/features/chat/components/ChatWindow.tsx',
  'src/features/chat/components/ChatHeader.tsx',
  'src/features/chat/components/MessageHistory.tsx',
  'src/features/chat/components/MessageBubble.tsx',
  'src/features/chat/components/MessageStatusIcon.tsx',
  'src/features/chat/components/TypingIndicator.tsx',
  'src/features/chat/components/MessageComposer.tsx',
  'src/features/chat/components/AttachmentPreview.tsx',
  'src/features/chat/components/EmptyChatState.tsx',
  'src/features/chat/hooks/useMessages.ts',
  'src/features/chat/hooks/useSendMessage.ts',
  'src/features/chat/hooks/useDeleteMessage.ts',
  'src/features/chat/hooks/useTyping.ts',
  'src/features/chat/hooks/useReadReceipts.ts',
  'src/features/chat/api.ts',
  'src/features/chat/index.ts',

  // Feature: contacts
  'src/features/contacts/components/ChatList.tsx',
  'src/features/contacts/components/ChatSessionRow.tsx',
  'src/features/contacts/components/FriendRow.tsx',
  'src/features/contacts/components/GroupRow.tsx',
  'src/features/contacts/components/FindFriendsModal.tsx',
  'src/features/contacts/components/UserSearchResultRow.tsx',
  'src/features/contacts/hooks/useConversations.ts',
  'src/features/contacts/hooks/useContacts.ts',
  'src/features/contacts/hooks/useUserSearch.ts',
  'src/features/contacts/hooks/useFriendRequest.ts',
  'src/features/contacts/hooks/useRemoveFriend.ts',
  'src/features/contacts/hooks/useBlockUser.ts',
  'src/features/contacts/api.ts',
  'src/features/contacts/index.ts',

  // Feature: groups
  'src/features/groups/components/CreateGroupModal.tsx',
  'src/features/groups/components/GroupSettingsModal.tsx',
  'src/features/groups/components/InviteMembersModal.tsx',
  'src/features/groups/components/MemberRow.tsx',
  'src/features/groups/hooks/useCreateGroup.ts',
  'src/features/groups/hooks/useGroupSettings.ts',
  'src/features/groups/hooks/useInviteMembers.ts',
  'src/features/groups/hooks/useLeaveGroup.ts',
  'src/features/groups/api.ts',
  'src/features/groups/index.ts',

  // Feature: notifications
  'src/features/notifications/components/NotificationList.tsx',
  'src/features/notifications/components/FriendRequestItem.tsx',
  'src/features/notifications/components/GroupInviteItem.tsx',
  'src/features/notifications/components/JoinRequestItem.tsx',
  'src/features/notifications/components/GenericNotificationItem.tsx',
  'src/features/notifications/hooks/useNotifications.ts',
  'src/features/notifications/hooks/useNotificationActions.ts',
  'src/features/notifications/api.ts',
  'src/features/notifications/index.ts',

  // Feature: presence
  'src/features/presence/components/PresenceSelector.tsx',
  'src/features/presence/hooks/usePresence.ts',
  'src/features/presence/hooks/useUpdatePresence.ts',
  'src/features/presence/hooks/usePresenceFeed.ts',
  'src/features/presence/api.ts',
  'src/features/presence/index.ts',

  // Feature: settings
  'src/features/settings/components/ProfileSection.tsx',
  'src/features/settings/components/SecuritySection.tsx',
  'src/features/settings/components/BlockedUsersSection.tsx',
  'src/features/settings/components/LogoutButton.tsx',
  'src/features/settings/hooks/useUpdateProfile.ts',
  'src/features/settings/hooks/useChangePassword.ts',
  'src/features/settings/hooks/useBlockedUsers.ts',
  'src/features/settings/api.ts',
  'src/features/settings/index.ts',

  // E2E
  'e2e/auth.spec.ts',
  'e2e/chat.spec.ts',
  'e2e/groups.spec.ts',

  // Docs
//   'docs/design/fe-design.md',
];

const missing = required.filter(p => !existsSync(p));

if (missing.length > 0) {
  console.error(`\n✗ check-structure: ${missing.length} missing path(s):\n`);
  missing.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

console.log(`✓ check-structure: all ${required.length} required paths present`);
process.exit(0);