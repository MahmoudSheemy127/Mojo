// src/features/settings/components/LogoutButton.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useLogout } from '@/features/auth';

/** Destructive log-out control with a confirm step (FR-03). */
export function LogoutButton() {
  const [confirming, setConfirming] = useState(false);
  const logout = useLogout();

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant="danger"
        onClick={() => setConfirming(true)}
        isLoading={logout.isPending}
      >
        Log out
      </Button>
      <p className="text-xs text-text-muted">
        You&apos;ll be signed out on this device and returned to the login screen.
      </p>

      <ConfirmDialog
        open={confirming}
        title="Log out?"
        message="You'll need to sign in again to access your conversations."
        confirmLabel="Log out"
        cancelLabel="Stay signed in"
        destructive
        onConfirm={() => logout.mutate()}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}
