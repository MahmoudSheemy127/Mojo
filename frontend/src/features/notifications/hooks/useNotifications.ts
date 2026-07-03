// src/features/notifications/hooks/useNotifications.ts
import { useCallback } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import type { Notification, NotificationKind } from '@/types/entities';
import type { ApiNotification, NotificationType } from '@/types/api';
import type { SocketNotification } from '@/types/socket';
import { formatRelative } from '@/utils/formatDate';
import {
  fetchNotifications,
  fetchNotificationCount,
  markNotificationsSeen,
} from '../api';

export const notificationsKey = ['notifications'] as const;
export const notificationsCountKey = ['notifications', 'count'] as const;

function toKind(type: NotificationType): NotificationKind {
  switch (type) {
    case 'friend_request':
      return 'friend-request';
    case 'group_invite':
      return 'group-invite';
    case 'group_join_request':
      return 'join-request';
    default:
      return 'generic';
  }
}

/** The common shape shared by the REST `Notification` and the socket payload. */
interface RawNotification {
  id: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actor: ApiNotification['actor'] | SocketNotification['actor'];
  payload: {
    requestId?: string | undefined;
    inviteId?: string | undefined;
    groupId?: string | undefined;
    conversationId?: string | undefined;
    messageId?: string | undefined;
    text?: string | undefined;
  };
}

function toText(notif: RawNotification): string {
  const name = notif.actor?.displayName ?? 'Someone';
  switch (notif.type) {
    case 'friend_request':
      return `${name} sent you a friend request.`;
    case 'friend_request_accepted':
      return `${name} accepted your friend request.`;
    case 'group_invite':
      return `${name} invited you to a group.`;
    case 'group_join_request':
      return `${name} wants to join your group.`;
    case 'mention':
      return notif.payload.text ?? `${name} mentioned you.`;
    case 'missed_call':
      return `${name} tried to call you.`;
    default:
      return notif.payload.text ?? 'New notification';
  }
}

/** Maps a REST or socket notification to the presentation entity. */
export function mapNotification(notif: RawNotification): Notification {
  return {
    id: notif.id,
    kind: toKind(notif.type),
    actor: {
      id: notif.actor?.id ?? '',
      username: notif.actor?.username ?? '',
      displayName: notif.actor?.displayName ?? 'Unknown',
      avatarUrl: notif.actor?.avatarUrl ?? undefined,
    },
    text: toText(notif),
    createdAt: formatRelative(notif.createdAt),
    unread: !notif.read,
    requestId: notif.payload.requestId,
    inviteId: notif.payload.inviteId,
    groupId: notif.payload.groupId,
    conversationId: notif.payload.conversationId,
    messageId: notif.payload.messageId,
  };
}

/**
 * Provides the notifications feed (key `['notifications']`). Loaded from the REST
 * endpoint, newest first; live notifications arrive via `notification:new` and are
 * prepended to the cache (also bumping the unseen count).
 */
export function useNotifications() {
  const queryClient = useQueryClient();

  const query = useQuery<Notification[]>({
    queryKey: notificationsKey,
    queryFn: async () => {
      const res = await fetchNotifications();
      return res.data.map(mapNotification);
    },
  });

  const onNotificationNew = useCallback(
    (payload: { notification: SocketNotification }) => {
      const notification = mapNotification(payload.notification);
      queryClient.setQueryData<Notification[]>(notificationsKey, (old) => [
        notification,
        ...(old ?? []),
      ]);
      queryClient.setQueryData<number>(
        notificationsCountKey,
        (old) => (old ?? 0) + 1,
      );
    },
    [queryClient],
  );
  useSocketEvent('notification:new', onNotificationNew);

  return query;
}

/**
 * Unseen notification count (key `['notifications', 'count']`), drives the bell
 * badge. Loaded from `/notifications/count`, live-incremented by `notification:new`
 * (see `useNotifications`) and reset to 0 by the mark-seen mutation.
 */
export function useNotificationCount(): number {
  const query = useQuery<number>({
    queryKey: notificationsCountKey,
    queryFn: fetchNotificationCount,
  });
  return query.data ?? 0;
}

/**
 * Mark-seen mutation. Clears the bell badge (count → 0) without resolving
 * actionable items — they stay actionable until accepted/declined via their
 * domain endpoints. Called when the notification dropdown opens.
 */
export function useMarkNotificationsSeen() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) => markNotificationsSeen(ids),
    // Optimistically clear the badge so it feels instant on open.
    onMutate: () => {
      const previous = queryClient.getQueryData<number>(notificationsCountKey);
      queryClient.setQueryData<number>(notificationsCountKey, 0);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData<number>(
          notificationsCountKey,
          context.previous,
        );
      }
    },
  });
}
