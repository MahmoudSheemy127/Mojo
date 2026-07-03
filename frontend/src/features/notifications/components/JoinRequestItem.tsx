// src/features/notifications/components/JoinRequestItem.tsx
import type { Notification } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { cn } from '@/utils/cn';
import { useNotificationActions } from '../hooks/useNotificationActions';

interface JoinRequestItemProps {
  notification: Notification;
}

/** Group join request (admin-only) with Accept / Decline (FR-19). */
export function JoinRequestItem({ notification }: JoinRequestItemProps) {
  const { acceptJoinRequest, declineJoinRequest } = useNotificationActions();
  const { groupId, requestId } = notification;
  const canAct = Boolean(groupId && requestId);
  const busy = acceptJoinRequest.isPending || declineJoinRequest.isPending;

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
            isLoading={acceptJoinRequest.isPending}
            disabled={busy || !canAct}
            onClick={() =>
              groupId &&
              requestId &&
              acceptJoinRequest.mutate({
                groupId,
                requestId,
                notifId: notification.id,
              })
            }
          >
            Accept
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isLoading={declineJoinRequest.isPending}
            disabled={busy || !canAct}
            onClick={() =>
              groupId &&
              requestId &&
              declineJoinRequest.mutate({
                groupId,
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
