// src/features/settings/index.ts
// Public surface of the settings feature.
export { ProfileSection } from './components/ProfileSection';
export { SecuritySection } from './components/SecuritySection';
export { BlockedUsersSection } from './components/BlockedUsersSection';
export { LogoutButton } from './components/LogoutButton';
export { useMe, meKey } from './hooks/useMe';
export { useUpdateProfile } from './hooks/useUpdateProfile';
export { useUploadAvatar, useDeleteAvatar } from './hooks/useAvatar';
export { useRequestPasswordReset } from './hooks/useChangePassword';
export { useBlockedUsers, useUnblockUser } from './hooks/useBlockedUsers';
