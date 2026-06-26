// src/features/settings/components/BlockedUsersSection.tsx
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import type { PublicUser } from '@/types/api';
import { useBlockedUsers, useUnblockUser } from '../hooks/useBlockedUsers';

/** Blocked-users list with per-row unblock (FR-09). */
export function BlockedUsersSection() {
  const { data: blocked, isLoading, isError, refetch } = useBlockedUsers();
  const unblock = useUnblockUser();
  const [confirming, setConfirming] = useState<PublicUser | null>(null);

  return (
    <section aria-labelledby="blocked-heading" className="flex flex-col gap-3">
      <div>
        <h2
          id="blocked-heading"
          className="text-base font-semibold text-text-normal"
        >
          Blocked users
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Blocked users can&apos;t message you or see your activity.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Spinner label="Loading blocked users" />
          Loading…
        </div>
      ) : isError ? (
        <div className="flex flex-col items-start gap-2">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load your blocked users.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : !blocked || blocked.length === 0 ? (
        <p className="text-sm text-text-muted">You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-bg-deepest">
          {blocked.map((user) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar
                  name={user.displayName}
                  src={user.avatarUrl ?? undefined}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-normal">
                    {user.displayName}
                  </p>
                  <p className="truncate text-xs text-text-muted">
                    @{user.username}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirming(user)}
                isLoading={unblock.isPending && unblock.variables === user.id}
              >
                Unblock
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming !== null}
        title="Unblock user?"
        message={
          confirming
            ? `${confirming.displayName} will be able to message you and see your activity again.`
            : ''
        }
        confirmLabel="Unblock"
        onConfirm={() => {
          if (confirming) unblock.mutate(confirming.id);
        }}
        onClose={() => setConfirming(null)}
      />
    </section>
  );
}
