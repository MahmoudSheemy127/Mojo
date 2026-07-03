// src/features/notifications/components/GenericNotificationItem.tsx
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { cn } from '@/utils/cn';

interface GenericNotificationItemProps {
  notification: Notification;
}

/**
 * Non-actionable notification (accepted request, mention, missed call…).
 * Mentions carry a conversation id and navigate to that chat on click.
 */
export function GenericNotificationItem({
  notification,
}: GenericNotificationItemProps) {
  const navigate = useNavigate();
  const conversationId = notification.conversationId;
  const navigable = Boolean(conversationId);

  const content = (
    <>
      <Avatar
        name={notification.actor.displayName}
        src={notification.actor.avatarUrl}
        size="sm"
      />
      <p className="min-w-0 flex-1 text-left text-sm text-text-normal">
        {notification.text}
      </p>
      <MessageTimestamp relative={notification.createdAt} />
    </>
  );

  return (
    <li
      className={cn(
        'flex items-center gap-3 px-3 py-2.5',
        notification.unread && 'bg-bg-hover/40',
        navigable && 'cursor-pointer hover:bg-bg-hover',
      )}
    >
      {navigable ? (
        <button
          type="button"
          onClick={() => void navigate(`/c/${conversationId}`)}
          className="flex w-full items-center gap-3 text-left"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </li>
  );
}
