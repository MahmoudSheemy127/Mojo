// src/features/contacts/components/UserSearchResultRow.tsx
import type { User } from '@/types/entities';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

export type RelationshipState = 'none' | 'requested' | 'friends';

interface UserSearchResultRowProps {
  user: User;
  relationship?: RelationshipState | undefined;
  onAdd?: (() => void) | undefined;
}

/** A user search result with a relationship-aware action. */
export function UserSearchResultRow({
  user,
  relationship = 'none',
  onAdd,
}: UserSearchResultRowProps) {
  return (
    <li className="flex items-center gap-3 px-1 py-2">
      <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-text-normal">
          {user.displayName}
        </span>
        <span className="truncate text-xs text-text-muted">
          @{user.username}
        </span>
      </div>

      {relationship === 'friends' ? (
        <span className="text-xs text-text-muted">Friends</span>
      ) : relationship === 'requested' ? (
        <Button size="sm" variant="secondary" disabled>
          Requested
        </Button>
      ) : (
        <Button size="sm" variant="primary" onClick={onAdd}>
          Add friend
        </Button>
      )}
    </li>
  );
}
