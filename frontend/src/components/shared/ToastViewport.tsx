// src/components/shared/ToastViewport.tsx
import { useEffect } from 'react';
import { Toast } from '@/components/ui/Toast';
import { useToastStore, type ToastItem } from '@/hooks/useToast';

const AUTO_DISMISS_MS = 4000;

/** A single toast that auto-dismisses itself after a delay. */
function ToastRow({ toast }: { toast: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dismiss]);

  return (
    <Toast
      message={toast.message}
      variant={toast.variant}
      onDismiss={() => dismiss(toast.id)}
    />
  );
}

/**
 * Renders the global toast queue as a stacked, bottom-right overlay. Mounted
 * once at the app root so any feature can call `useToast()`.
 */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastRow toast={toast} />
        </div>
      ))}
    </div>
  );
}
