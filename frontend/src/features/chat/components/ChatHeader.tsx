// src/features/chat/components/ChatHeader.tsx
import type { ConversationSummary } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/IconButton';
import { UserAvatarWithPresence } from '@/components/shared/UserAvatarWithPresence';

interface ChatHeaderProps {
  conversation: ConversationSummary;
  /** Group only: whether the current user can manage the group. */
  isAdmin?: boolean | undefined;
  onInvite: () => void;
  onOpenGroupSettings?: (() => void) | undefined;
  onLeaveGroup?: (() => void) | undefined;
  onBlock?: (() => void) | undefined;
  onRemoveFriend?: (() => void) | undefined;
}

const presenceText: Record<string, string> = {
  online: 'Online',
  idle: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

/** Contextual conversation header. Voice call button omitted (no backing FR). */
export function ChatHeader({
  conversation,
  isAdmin = false,
  onInvite,
  onOpenGroupSettings,
  onLeaveGroup,
  onBlock,
  onRemoveFriend,
}: ChatHeaderProps) {
  const isDm = conversation.type === 'dm';

  const menuItems: DropdownMenuItem[] = isDm
    ? [
        ...(onBlock
          ? [{ label: 'Block user', onSelect: onBlock, variant: 'danger' as const }]
          : []),
        ...(onRemoveFriend
          ? [
              {
                label: 'Remove friend',
                onSelect: onRemoveFriend,
                variant: 'danger' as const,
              },
            ]
          : []),
      ]
    : [
        ...(isAdmin && onOpenGroupSettings
          ? [{ label: 'Group settings', onSelect: onOpenGroupSettings }]
          : []),
        ...(onLeaveGroup
          ? [
              {
                label: 'Leave group',
                onSelect: onLeaveGroup,
                variant: 'danger' as const,
              },
            ]
          : []),
      ];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-bg-deepest px-4">
      <div className="flex min-w-0 items-center gap-3">
        {isDm ? (
          <UserAvatarWithPresence
            name={conversation.name}
            presence={conversation.presence}
            size="sm"
          />
        ) : (
          <Avatar name={conversation.name} size="sm" square />
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-text-normal">
            {conversation.name}
          </span>
          <span className="truncate text-xs text-text-muted">
            {isDm
              ? conversation.presence
                ? presenceText[conversation.presence]
                : ''
              : 'Group'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Voice call button intentionally omitted — no backing FR (see README). */}
        <Button size="sm" variant="ghost" onClick={onInvite}>
          {isDm ? 'Create group' : 'Invite'}
        </Button>
        {menuItems.length > 0 && (
          <DropdownMenu
            trigger={({ toggle }) => (
              <IconButton aria-label="Conversation actions" onClick={toggle}>
                <span aria-hidden>⋯</span>
              </IconButton>
            )}
            items={menuItems}
          />
        )}
      </div>
    </header>
  );
}
