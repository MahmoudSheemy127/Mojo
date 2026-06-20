// src/components/ui/Toast.tsx
import { cn } from '@/utils/cn';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  variant?: ToastVariant | undefined;
  onDismiss?: (() => void) | undefined;
  className?: string | undefined;
}

const variantClasses: Record<ToastVariant, string> = {
  success: 'border-l-online',
  error: 'border-l-danger',
  info: 'border-l-accent',
};

/**
 * Presentational toast. The triggering/stacking provider belongs to the state
 * layer (useToast) and is intentionally not wired here yet.
 */
export function Toast({
  message,
  variant = 'info',
  onDismiss,
  className,
}: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-between gap-3 rounded-card border-l-4 bg-bg-sidebar px-4 py-3 text-sm text-text-normal shadow-xl',
        variantClasses[variant],
        className,
      )}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="text-text-muted transition-colors hover:text-text-normal"
        >
          <span aria-hidden>✕</span>
        </button>
      )}
    </div>
  );
}
