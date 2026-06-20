// src/features/contacts/components/FriendRow.tsx
import type { User } from '@/types/entities';
import { UserAvatarWithPresence } from '@/components/shared/UserAvatarWithPresence';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/utils/cn';

interface FriendRowProps {
  friend: User;
  onMessage: () => void;
  onBlock?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}

const presenceLabel: Record<string, string> = {
  online: 'Online',
  idle: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

/** A row in the Friends subsection: avatar + presence, name, overflow menu. */
export function FriendRow({
  friend,
  onMessage,
  onBlock,
  onRemove,
}: FriendRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-card px-2 py-2 transition-colors hover:bg-bg-hover">
      <button
        type="button"
        onClick={onMessage}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <UserAvatarWithPresence
          name={friend.displayName}
          presence={friend.presence}
          size="md"
        />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm text-text-normal">
            {friend.displayName}
          </span>
          <span className="truncate text-xs text-text-muted">
            {friend.presence ? presenceLabel[friend.presence] : `@${friend.username}`}
          </span>
        </span>
      </button>

      <DropdownMenu
        trigger={({ toggle }) => (
          <IconButton
            aria-label={`Actions for ${friend.displayName}`}
            onClick={toggle}
            className={cn('opacity-0 group-hover:opacity-100 focus:opacity-100')}
          >
            <span aria-hidden>⋯</span>
          </IconButton>
        )}
        items={[
          { label: 'Message', onSelect: onMessage },
          ...(onBlock ? [{ label: 'Block', onSelect: onBlock }] : []),
          ...(onRemove
            ? [
                {
                  label: 'Remove friend',
                  onSelect: onRemove,
                  variant: 'danger' as const,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
