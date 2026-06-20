// src/pages/SettingsPage.tsx
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

/**
 * Settings placeholder. The full settings experience is its own spec (page 03);
 * this route exists so homepage → Settings navigation is valid.
 */
export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg-chat px-6 text-center">
      <h1 className="text-xl font-semibold text-text-normal">Settings</h1>
      <p className="max-w-sm text-sm text-text-muted">
        Settings are coming soon.
      </p>
      <Button variant="secondary" onClick={() => navigate('/c')}>
        Back to chats
      </Button>
    </div>
  );
}
