// src/features/notifications/api.ts
import { api } from '@/lib/axios';
import type {
  NotificationsListResponse,
  NotificationCountResponse,
} from '@/types/api';

/** GET /notifications — paginated feed, newest first (FR-30). */
export async function fetchNotifications(
  cursor?: string,
): Promise<NotificationsListResponse> {
  const { data } = await api.get<NotificationsListResponse>('/notifications', {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

/** GET /notifications/count — unseen count driving the bell badge (FR-30). */
export async function fetchNotificationCount(): Promise<number> {
  const { data } = await api.get<NotificationCountResponse>(
    '/notifications/count',
  );
  return data.count;
}

/**
 * POST /notifications/seen — mark notifications seen (FR-30). Omit `ids` to
 * mark all unseen as seen. Seen ≠ resolved: actionable items stay actionable.
 */
export async function markNotificationsSeen(ids?: string[]): Promise<void> {
  await api.post('/notifications/seen', ids ? { ids } : undefined);
}
