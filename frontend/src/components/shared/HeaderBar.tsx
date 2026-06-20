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
import { PresenceSelector } from '@/features/presence';
import { useOverlay } from '@/layouts/overlayContext';
import { currentUser } from '@/lib/placeholder';

type OpenPopover = 'notifications' | 'profile' | null;

const UNREAD_NOTIFICATIONS = 2;

/**
 * Persistent top bar: app name, Find friends entry, notification bell, and the
 * profile/presence/settings popover. Only one popover open at a time.
 */
export function HeaderBar() {
  const [open, setOpen] = useState<OpenPopover>(null);
  const navigate = useNavigate();
  const { openModal } = useOverlay();

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
                <Badge count={UNREAD_NOTIFICATIONS} />
              </span>
            </IconButton>
          }
          className="p-0"
        >
          <NotificationList />
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
              <Avatar name={currentUser.displayName} size="sm" />
              {currentUser.presence && (
                <PresenceDot
                  presence={currentUser.presence}
                  size="sm"
                  ring
                  className="absolute bottom-0 right-0"
                />
              )}
            </button>
          }
        >
          <div className="flex flex-col gap-2 p-1">
            <div className="px-2 py-1">
              <p className="text-sm font-semibold text-text-normal">
                {currentUser.displayName}
              </p>
              <p className="text-xs text-text-muted">@{currentUser.username}</p>
            </div>

            <div className="border-t border-bg-deepest pt-2">
              <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Status
              </p>
              <PresenceSelector value={currentUser.presence} />
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
                // Real logout clears authStore + invalidates the token; here we
                // just return to the login screen.
                onClick={() => void navigate('/login')}
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
