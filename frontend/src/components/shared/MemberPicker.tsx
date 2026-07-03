// src/components/shared/MemberPicker.tsx
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { Avatar } from '@/components/ui/Avatar';
import type { PublicUser } from '@/types/api';

interface MemberPickerProps {
  /** Pool to search over (friends or all users). */
  candidates: PublicUser[];
  value: PublicUser[];
  onChange: (next: PublicUser[]) => void;
  /** Ids that cannot be selected — shown disabled with "Member" tag. */
  excludeIds?: string[] | undefined;
  /** Ids that have been invited but not yet joined — shown disabled with "Invited" tag. */
  invitedIds?: string[] | undefined;
  /** When true, disables all interaction (search input + result buttons). */
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
}

/**
 * Search bar + results list + selected chips. Shared between CreateGroupModal
 * and InviteMembersModal. Filtering is local; candidates come from the parent hook.
 */
export function MemberPicker({
  candidates,
  value,
  onChange,
  excludeIds = [],
  invitedIds = [],
  disabled = false,
  placeholder = 'Search friends…',
}: MemberPickerProps) {
  const [query, setQuery] = useState('');

  const selectedIds = new Set(value.map((u) => u.id));
  const excluded = new Set(excludeIds);
  const invited = new Set(invitedIds);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((u) => {
        if (selectedIds.has(u.id)) return false; // shown as chip above
        if (!q) return true;
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // disabled rows (excluded or invited) sink to the bottom
        const aDisabled = excluded.has(a.id) || invited.has(a.id) ? 1 : 0;
        const bDisabled = excluded.has(b.id) || invited.has(b.id) ? 1 : 0;
        return aDisabled - bDisabled;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, query, value, excludeIds, invitedIds]);

  function add(user: PublicUser) {
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
        disabled={disabled}
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
          results.map((u) => {
            const isExcluded = excluded.has(u.id);
            const isInvited = invited.has(u.id);
            const isDisabled = disabled || isExcluded || isInvited;
            const tag = isExcluded ? 'Member' : isInvited ? 'Invited' : null;
            return (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={isDisabled ? undefined : () => add(u)}
                  disabled={isDisabled}
                  aria-disabled={isDisabled}
                  className={`flex w-full items-center gap-2 rounded-card px-2 py-1.5 text-left transition-colors ${
                    isDisabled
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-bg-hover'
                  }`}
                >
                  <Avatar
                    name={u.displayName}
                    src={u.avatarUrl ?? undefined}
                    size="sm"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm text-text-normal">
                      {u.displayName}
                    </span>
                    <span className="text-xs text-text-muted">
                      @{u.username}
                    </span>
                  </span>
                  {tag && (
                    <span className="ml-auto text-xs font-medium text-text-muted">
                      {tag}
                    </span>
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
