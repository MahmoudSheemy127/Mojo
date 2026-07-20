// src/features/notifications/index.ts
// Public surface of the notifications feature.
export { NotificationList } from './components/NotificationList';
export {
  useNotifications,
  useNotificationSocket,
  useNotificationCount,
  useMarkNotificationsSeen,
  mapNotification,
  notificationsKey,
  notificationsCountKey,
} from './hooks/useNotifications';
export { useNotificationActions } from './hooks/useNotificationActions';
