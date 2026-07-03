// src/features/notifications/components/NotificationList.tsx
import { useEffect } from 'react';
import type { Notification } from '@/types/entities';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  useNotifications,
  useMarkNotificationsSeen,
} from '../hooks/useNotifications';
import { FriendRequestItem } from './FriendRequestItem';
import { GroupInviteItem } from './GroupInviteItem';
import { JoinRequestItem } from './JoinRequestItem';
import { GenericNotificationItem } from './GenericNotificationItem';

function renderItem(n: Notification) {
  switch (n.kind) {
    case 'friend-request':
      return <FriendRequestItem key={n.id} notification={n} />;
    case 'group-invite':
      return <GroupInviteItem key={n.id} notification={n} />;
    case 'join-request':
      return <JoinRequestItem key={n.id} notification={n} />;
    case 'generic':
      return <GenericNotificationItem key={n.id} notification={n} />;
  }
}

/**
 * Notification dropdown body. Loads the feed, marks it seen on open (clears the
 * bell badge), and renders loading / error / empty / item states. Actionable
 * rows dispatch accept/decline through `useNotificationActions`.
 */
export function NotificationList() {
  const { data: items = [], isLoading, isError, refetch } = useNotifications();
  const markSeen = useMarkNotificationsSeen();

  // Mark seen when the dropdown mounts (i.e. opens). `mutate` is referentially
  // stable, so this runs once per open.
  const markSeenMutate = markSeen.mutate;
  useEffect(() => {
    markSeenMutate(undefined);
  }, [markSeenMutate]);

  return (
    <div className="w-80">
      <div className="flex items-center justify-between border-b border-bg-deepest px-3 py-2">
        <h2 className="text-sm font-semibold text-text-normal">Notifications</h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => markSeenMutate(undefined)}
          disabled={items.length === 0}
        >
          Mark all read
        </Button>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-2 p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-avatar" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex flex-col items-center gap-2 p-6 text-center">
          <p className="text-sm text-text-muted">Couldn’t load notifications.</p>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading &&
        !isError &&
        (items.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">
            You’re all caught up.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-bg-deepest overflow-y-auto">
            {items.map(renderItem)}
          </ul>
        ))}
    </div>
  );
}
