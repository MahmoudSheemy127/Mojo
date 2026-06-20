// src/components/shared/MemberPicker.tsx
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import type { User } from '@/types/entities';

interface MemberPickerProps {
  /** Pool to search over (friends or all users). */
  candidates: User[];
  value: User[];
  onChange: (next: User[]) => void;
  /** Ids that cannot be selected (e.g. existing group members). */
  excludeIds?: string[] | undefined;
  placeholder?: string | undefined;
}

/**
 * Search bar + results list + selected chips. Shared between CreateGroupModal
 * and InviteMembersModal. Filtering is local; no server search yet.
 */
export function MemberPicker({
  candidates,
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Search friends…',
}: MemberPickerProps) {
  const [query, setQuery] = useState('');

  const selectedIds = new Set(value.map((u) => u.id));
  const excluded = new Set(excludeIds);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((u) => {
      if (selectedIds.has(u.id) || excluded.has(u.id)) return false;
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
      );
    });
    // selectedIds/excluded derive from props each render; query drives the filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, query, value, excludeIds]);

  function add(user: User) {
    onChange([...value, user]);
  }
  function remove(id: string) {
    onChange(value.filter((u) => u.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label="Search members"
      />

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((u) => (
            <Chip key={u.id} onRemove={() => remove(u.id)}>
              {u.displayName}
            </Chip>
          ))}
        </div>
      )}

      <ul className="max-h-48 overflow-y-auto">
        {results.length === 0 ? (
          <li className="px-2 py-3 text-sm text-text-muted">No matches.</li>
        ) : (
          results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => add(u)}
                className="flex w-full items-center gap-2 rounded-card px-2 py-1.5 text-left transition-colors hover:bg-bg-hover"
              >
                <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
                <span className="flex flex-col">
                  <span className="text-sm text-text-normal">
                    {u.displayName}
                  </span>
                  <span className="text-xs text-text-muted">@{u.username}</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
