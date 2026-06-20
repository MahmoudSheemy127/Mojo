// src/features/groups/components/MemberRow.tsx
import type { GroupMember } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { IconButton } from '@/components/ui/IconButton';
import { RoleBadge } from '@/components/shared/RoleBadge';

interface MemberRowProps {
  member: GroupMember;
  /** Whether the current viewer can manage this member. */
  manageable?: boolean | undefined;
  onPromote?: (() => void) | undefined;
  onDemote?: (() => void) | undefined;
  onRemove?: (() => void) | undefined;
}

/** A group member row: avatar, name, role badge, action menu. */
export function MemberRow({
  member,
  manageable = false,
  onPromote,
  onDemote,
  onRemove,
}: MemberRowProps) {
  const isAdmin = member.role === 'admin';

  return (
    <div className="group flex items-center gap-3 rounded-card px-2 py-2 hover:bg-bg-hover">
      <Avatar
        name={member.user.displayName}
        src={member.user.avatarUrl}
        size="sm"
      />
      <span className="min-w-0 flex-1 truncate text-sm text-text-normal">
        {member.user.displayName}
      </span>
      <RoleBadge role={member.role} />

      {manageable && (
        <DropdownMenu
          trigger={({ toggle }) => (
            <IconButton
              aria-label={`Manage ${member.user.displayName}`}
              onClick={toggle}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <span aria-hidden>⋯</span>
            </IconButton>
          )}
          items={[
            isAdmin
              ? { label: 'Demote to member', onSelect: onDemote ?? (() => {}) }
              : { label: 'Promote to admin', onSelect: onPromote ?? (() => {}) },
            {
              label: 'Remove from group',
              onSelect: onRemove ?? (() => {}),
              variant: 'danger',
            },
          ]}
        />
      )}
    </div>
  );
}
