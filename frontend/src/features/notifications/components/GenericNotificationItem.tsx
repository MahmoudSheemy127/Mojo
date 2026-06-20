// src/features/notifications/components/GenericNotificationItem.tsx
import type { Notification } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { cn } from '@/utils/cn';

interface GenericNotificationItemProps {
  notification: Notification;
}

/** Non-actionable notification (accepted request, mention, missed call…). */
export function GenericNotificationItem({
  notification,
}: GenericNotificationItemProps) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2.5',
        notification.unread && 'bg-bg-hover/40',
      )}
    >
      <Avatar
        name={notification.actor.displayName}
        src={notification.actor.avatarUrl}
        size="sm"
      />
      <p className="min-w-0 flex-1 text-sm text-text-normal">
        {notification.text}
      </p>
      <MessageTimestamp relative={notification.createdAt} />
    </li>
  );
}
