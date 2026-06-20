// src/features/notifications/components/GroupInviteItem.tsx
import type { Notification } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { cn } from '@/utils/cn';

interface GroupInviteItemProps {
  notification: Notification;
}

/** Group invitation with Accept / Decline. */
export function GroupInviteItem({ notification }: GroupInviteItemProps) {
  return (
    <li
      className={cn(
        'flex gap-3 px-3 py-2.5',
        notification.unread && 'bg-bg-hover/40',
      )}
    >
      <Avatar name={notification.groupName ?? 'Group'} size="sm" square />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-sm text-text-normal">{notification.text}</p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary">
            Accept
          </Button>
          <Button size="sm" variant="ghost">
            Decline
          </Button>
        </div>
      </div>
      <MessageTimestamp relative={notification.createdAt} />
    </li>
  );
}
