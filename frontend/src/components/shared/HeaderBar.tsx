// src/components/shared/HeaderBar.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Popover } from '@/components/ui/Popover';
import { PresenceDot } from '@/components/shared/PresenceDot';
import { NotificationList } from '@/features/notifications';
import {
  useNotificationCount,
  useNotificationSocket,
} from '@/features/notifications/hooks/useNotifications';
import {
  PresenceSelector,
  toUiPresence,
  toSettableStatus,
  useUpdatePresence,
} from '@/features/presence';
import { useMe } from '@/features/settings';
import { useLogout } from '@/features/auth';
import { useOverlay } from '@/layouts/overlayContext';
import type { Presence } from '@/types/entities';

type OpenPopover = 'notifications' | 'profile' | null;

/**
 * Persistent top bar: app name, Find friends entry, notification bell, and the
 * profile/presence/settings popover. Only one popover open at a time.
 */
export function HeaderBar() {
  const [open, setOpen] = useState<OpenPopover>(null);
  const navigate = useNavigate();
  const { openModal } = useOverlay();
  const { data: me } = useMe();
  const updatePresence = useUpdatePresence();
  const logout = useLogout();
  const unreadCount = useNotificationCount();
  // Always-mounted subscription to notification:new — keeps the feed cache and
  // bell badge live even while the notifications dropdown is closed.
  useNotificationSocket();

  const presence: Presence = me ? toUiPresence(me.presence) : 'offline';
  const displayName = me?.displayName ?? 'You';
  const pendingPresence =
    updatePresence.isPending && updatePresence.variables
      ? toUiPresence(updatePresence.variables)
      : undefined;

  // Persist the 3 settable statuses; 'offline' (Invisible) is socket-driven and
  // not settable via the contract, so it is shown but not PATCHed.
  function handlePresence(next: Presence) {
    const status = toSettableStatus(next);
    if (status) updatePresence.mutate(status);
  }

  const toggle = (which: Exclude<OpenPopover, null>) =>
    setOpen((cur) => (cur === which ? null : which));
  const close = () => setOpen(null);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-bg-deepest bg-bg-sidebar px-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-avatar bg-accent text-sm font-bold text-white">
          M
        </span>
        <span className="text-base font-bold text-text-normal">Mojo</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => openModal('find-friends')}
        >
          Find friends
        </Button>

        <Popover
          open={open === 'notifications'}
          onClose={close}
          trigger={
            <IconButton
              aria-label="Notifications"
              onClick={() => toggle('notifications')}
              className="relative"
            >
              <span aria-hidden>🔔</span>
              <span className="absolute -right-1 -top-1">
                <Badge count={unreadCount} />
              </span>
            </IconButton>
          }
          className="p-0"
        >
          {open === 'notifications' && <NotificationList />}
        </Popover>

        <Popover
          open={open === 'profile'}
          onClose={close}
          trigger={
            <button
              type="button"
              aria-label="Profile and status"
              onClick={() => toggle('profile')}
              className="relative inline-flex rounded-avatar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Avatar
                name={displayName}
                src={me?.avatarUrl ?? undefined}
                size="sm"
              />
              <PresenceDot
                presence={presence}
                size="sm"
                ring
                className="absolute bottom-0 right-0"
              />
            </button>
          }
        >
          <div className="flex flex-col gap-2 p-1">
            <div className="px-2 py-1">
              <p className="text-sm font-semibold text-text-normal">
                {displayName}
              </p>
              {me && (
                <p className="text-xs text-text-muted">@{me.username}</p>
              )}
            </div>

            <div className="border-t border-bg-deepest pt-2">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Status
              </p>
              <PresenceSelector
                value={presence}
                onSelect={handlePresence}
                pendingValue={pendingPresence}
              />
            </div>

            <div className="border-t border-bg-deepest pt-1">
              <button
                type="button"
                onClick={() => {
                  close();
                  void navigate('/settings');
                }}
                className="block w-full rounded-card px-2 py-1.5 text-left text-sm text-text-normal transition-colors hover:bg-bg-hover"
              >
                ⚙ Settings
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  logout.mutate();
                }}
                className="block w-full rounded-card px-2 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger/10"
              >
                Log out
              </button>
            </div>
          </div>
        </Popover>
      </div>
    </header>
  );
}
