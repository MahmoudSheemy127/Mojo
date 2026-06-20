// src/components/ui/IconButton.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required for accessibility — describes the action. */
  'aria-label': string;
}

/** Square button wrapping an icon. `aria-label` is mandatory. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, children, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-card text-text-muted',
          'transition-colors hover:bg-bg-hover hover:text-text-normal',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
