// src/components/ui/Tooltip.tsx
import { useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface TooltipProps {
  label: string;
  children: ReactNode;
  className?: string | undefined;
}

/** Minimal accessible hover/focus tooltip. */
export function Tooltip({ label, children, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap rounded-card bg-bg-deepest px-2 py-1 text-xs text-text-normal shadow-lg',
            className,
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
