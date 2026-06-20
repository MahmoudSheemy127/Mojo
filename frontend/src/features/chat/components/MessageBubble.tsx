// src/features/chat/components/MessageBubble.tsx
import type { Message } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/IconButton';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { cn } from '@/utils/cn';
import { MessageStatusIcon } from './MessageStatusIcon';

interface MessageBubbleProps {
  message: Message;
  /** When false, the avatar/name header is collapsed (consecutive messages). */
  showHeader?: boolean | undefined;
  onDelete?: (() => void) | undefined;
}

/** A single message row: avatar, text, timestamp, status, hover menu. */
export function MessageBubble({
  message,
  showHeader = true,
  onDelete,
}: MessageBubbleProps) {
  if (message.deleted) {
    return (
      <div className="px-4 py-0.5 pl-16 text-sm italic text-text-muted">
        This message was deleted
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-0.5 hover:bg-bg-hover/40',
        showHeader && 'mt-2',
      )}
    >
      <div className="w-10 shrink-0">
        {showHeader && (
          <Avatar
            name={message.authorName}
            src={message.authorAvatarUrl}
            size="md"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-text-normal">
              {message.authorName}
            </span>
            <MessageTimestamp relative={message.sentAt} iso={message.sentAtIso} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <p className="whitespace-pre-wrap break-words text-sm text-text-normal">
            {message.body}
          </p>
          {message.own && message.status && (
            <MessageStatusIcon status={message.status} />
          )}
        </div>
      </div>

      {message.own && onDelete && (
        <DropdownMenu
          trigger={({ toggle }) => (
            <IconButton
              aria-label="Message actions"
              onClick={toggle}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <span aria-hidden>⋯</span>
            </IconButton>
          )}
          items={[
            { label: 'Copy', onSelect: () => {} },
            { label: 'Delete', onSelect: onDelete, variant: 'danger' },
          ]}
        />
      )}
    </div>
  );
}
