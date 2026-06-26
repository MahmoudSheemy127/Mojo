// src/features/contacts/components/UserSearchResultRow.tsx
import type { PublicUser, Relationship } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

interface UserSearchResultRowProps {
  user: PublicUser;
  relationship: Relationship;
  isSending?: boolean;
  onAdd?: (() => void) | undefined;
}

/** A user search result row with a relationship-aware action (FR-05). */
export function UserSearchResultRow({
  user,
  relationship,
  isSending = false,
  onAdd,
}: UserSearchResultRowProps) {
  return (
    <li className="flex items-center gap-3 px-1 py-2">
      <Avatar name={user.displayName} src={user.avatarUrl ?? undefined} size="md" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-text-normal">{user.displayName}</span>
        <span className="truncate text-xs text-text-muted">@{user.username}</span>
      </div>

      {relationship === 'friends' ? (
        <span className="text-xs text-text-muted">Friends</span>
      ) : relationship === 'request_sent' ? (
        <Button size="sm" variant="secondary" disabled>
          Requested
        </Button>
      ) : relationship === 'request_received' ? (
        <Button size="sm" variant="primary" onClick={onAdd} isLoading={isSending}>
          Accept
        </Button>
      ) : relationship === 'blocked' || relationship === 'blocked_by' ? (
        <span className="text-xs text-text-muted">Unavailable</span>
      ) : (
        <Button size="sm" variant="primary" onClick={onAdd} isLoading={isSending}>
          {isSending ? <Spinner label="Sending request" /> : 'Add friend'}
        </Button>
      )}
    </li>
  );
}
