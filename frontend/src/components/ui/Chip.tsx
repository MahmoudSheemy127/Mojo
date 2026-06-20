// src/components/ui/Chip.tsx
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ChipProps {
  children: ReactNode;
  /** When provided, renders a remove (×) button. */
  onRemove?: (() => void) | undefined;
  className?: string | undefined;
}

/** Removable tag, used for selected-member lists. */
export function Chip({ children, onRemove, className }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-card bg-bg-active px-2 py-1 text-xs text-text-normal',
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label="Remove"
          onClick={onRemove}
          className="text-text-muted transition-colors hover:text-text-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden>✕</span>
        </button>
      )}
    </span>
  );
}
