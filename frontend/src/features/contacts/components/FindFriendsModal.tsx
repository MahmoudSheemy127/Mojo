// src/features/contacts/components/FindFriendsModal.tsx
import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { friends as placeholderUsers } from '@/lib/placeholder';
import {
  UserSearchResultRow,
  type RelationshipState,
} from './UserSearchResultRow';

interface FindFriendsModalProps {
  open: boolean;
  onClose: () => void;
}

// Canned relationship states so the result variants are all visible.
const RELATIONSHIPS: Record<string, RelationshipState> = {
  u1: 'none',
  u2: 'requested',
  u3: 'friends',
};

/** Global user-search modal (FR-05). Search filters placeholder users locally. */
export function FindFriendsModal({ open, onClose }: FindFriendsModalProps) {
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const results = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return [];
    return placeholderUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q),
    );
  }, [trimmed]);

  return (
    <Modal open={open} onClose={onClose} aria-label="Find friends">
      <ModalHeader title="Find friends" onClose={onClose} />
      <div className="flex flex-col gap-3 p-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          aria-label="Search users"
          trailing={query ? <Spinner className="text-text-muted" /> : undefined}
        />

        {trimmed === '' ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Start typing to find people by username.
          </p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            No users found for “{trimmed}”.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {results.map((u) => (
              <UserSearchResultRow
                key={u.id}
                user={u}
                relationship={RELATIONSHIPS[u.id] ?? 'none'}
              />
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
