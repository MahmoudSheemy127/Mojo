// src/features/notifications/components/FriendRequestItem.tsx
import type { Notification } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { cn } from '@/utils/cn';
import { useNotificationActions } from '../hooks/useNotificationActions';

interface FriendRequestItemProps {
  notification: Notification;
}

/** Friend invitation with Accept / Decline (FR-06). */
export function FriendRequestItem({ notification }: FriendRequestItemProps) {
  const { acceptFriendRequest, declineFriendRequest } = useNotificationActions();
  const requestId = notification.requestId;
  const busy = acceptFriendRequest.isPending || declineFriendRequest.isPending;

  return (
    <li
      className={cn(
        'flex gap-3 px-3 py-2.5',
        notification.unread && 'bg-bg-hover/40',
      )}
    >
      <Avatar
        name={notification.actor.displayName}
        src={notification.actor.avatarUrl}
        size="sm"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm text-text-normal">{notification.text}</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="primary"
            isLoading={acceptFriendRequest.isPending}
            disabled={busy || !requestId}
            onClick={() =>
              requestId &&
              acceptFriendRequest.mutate({ requestId, notifId: notification.id })
            }
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isLoading={declineFriendRequest.isPending}
            disabled={busy || !requestId}
            onClick={() =>
              requestId &&
              declineFriendRequest.mutate({
                requestId,
                notifId: notification.id,
              })
            }
          >
            Decline
          </Button>
        </div>
      </div>
      <MessageTimestamp relative={notification.createdAt} />
    </li>
  );
}
