// src/pages/SettingsPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@/components/ui/IconButton';
import {
  ProfileSection,
  SecuritySection,
  BlockedUsersSection,
  LogoutButton,
} from '@/features/settings';
import { cn } from '@/utils/cn';

type SectionId = 'profile' | 'security' | 'blocked' | 'logout';

const NAV: { id: SectionId; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'blocked', label: 'Blocked users' },
  { id: 'logout', label: 'Log out' },
];

/**
 * Settings page (spec 03): left section nav + right content pane. Closes back to
 * the Homepage via the close button or Esc.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId>('profile');

  const close = () => void navigate('/c');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-chat">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-bg-deepest px-6">
        <h1 className="text-lg font-semibold text-text-normal">Settings</h1>
        <IconButton aria-label="Close settings" onClick={close}>
          <span aria-hidden>✕</span>
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          aria-label="Settings sections"
          className="w-48 shrink-0 border-r border-bg-deepest p-3"
        >
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-current={section === item.id ? 'page' : undefined}
                  onClick={() => setSection(item.id)}
                  className={cn(
                    'w-full rounded-card px-3 py-1.5 text-left text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    section === item.id
                      ? 'bg-bg-active text-text-normal'
                      : 'text-text-muted hover:bg-bg-hover hover:text-text-normal',
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-xl">
            {section === 'profile' && <ProfileSection />}
            {section === 'security' && <SecuritySection />}
            {section === 'blocked' && <BlockedUsersSection />}
            {section === 'logout' && <LogoutButton />}
          </div>
        </main>
      </div>
    </div>
  );
}
