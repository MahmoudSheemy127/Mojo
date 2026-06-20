// src/features/contacts/components/ChatSessionRow.tsx
import type { ConversationSummary } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { UserAvatarWithPresence } from '@/components/shared/UserAvatarWithPresence';
import { UnreadBadge } from '@/components/shared/UnreadBadge';
import { cn } from '@/utils/cn';

interface ChatSessionRowProps {
  conversation: ConversationSummary;
  active?: boolean | undefined;
  onSelect: () => void;
}

/** A row in the "Chats" tab: avatar, name, preview, timestamp, unread badge. */
export function ChatSessionRow({
  conversation,
  active = false,
  onSelect,
}: ChatSessionRowProps) {
  const { type, name, presence, lastMessagePreview, lastMessageAt, typing } =
    conversation;
  const unread = conversation.unreadCount ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-card px-2 py-2 text-left transition-colors',
        active ? 'bg-bg-active' : 'hover:bg-bg-hover',
      )}
    >
      {type === 'dm' ? (
        <UserAvatarWithPresence name={name} presence={presence} size="md" />
      ) : (
        <Avatar name={name} size="md" square />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-sm',
              unread > 0 ? 'font-semibold text-text-normal' : 'text-text-normal',
            )}
          >
            {name}
          </span>
          {lastMessageAt && (
            <span className="shrink-0 text-xs text-text-muted">
              {lastMessageAt}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'truncate text-xs',
              typing ? 'italic text-accent' : 'text-text-muted',
            )}
          >
            {typing ? 'typing…' : lastMessagePreview}
          </span>
          <UnreadBadge count={unread} />
        </div>
      </div>
    </button>
  );
}
