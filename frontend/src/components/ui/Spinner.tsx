// src/components/ui/Spinner.tsx
import { cn } from '@/utils/cn';

interface SpinnerProps {
  className?: string;
  label?: string;
}

/** Small inline loading indicator. */
export function Spinner({ className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}
