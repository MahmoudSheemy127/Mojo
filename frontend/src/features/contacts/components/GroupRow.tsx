// src/features/contacts/components/GroupRow.tsx
import type { ConversationSummary } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/IconButton';

interface GroupRowProps {
  group: ConversationSummary;
  onOpen: () => void;
  onLeave?: (() => void) | undefined;
}

/** A row in the Groups subsection: group avatar + name, overflow menu. */
export function GroupRow({ group, onOpen, onLeave }: GroupRowProps) {
  return (
    <div className="group flex items-center gap-3 rounded-card px-2 py-2 transition-colors hover:bg-bg-hover">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar name={group.name} size="md" square />
        <span className="truncate text-sm text-text-normal">{group.name}</span>
      </button>

      <DropdownMenu
        trigger={({ toggle }) => (
          <IconButton
            aria-label={`Actions for ${group.name}`}
            onClick={toggle}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <span aria-hidden>⋯</span>
          </IconButton>
        )}
        items={[
          { label: 'Open', onSelect: onOpen },
          ...(onLeave
            ? [
                {
                  label: 'Leave group',
                  onSelect: onLeave,
                  variant: 'danger' as const,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
