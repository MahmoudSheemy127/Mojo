// src/components/ui/Overlay.tsx
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface OverlayProps {
  children?: ReactNode | undefined;
  /** Called when the backdrop itself (not its children) is clicked. */
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}

/** Dimmed fixed backdrop. Reused by Modal and anchored popovers. */
export function Overlay({ children, onClick, className }: OverlayProps) {
  return (
    <div
      // Clicks that bubble up from children are ignored — only direct
      // backdrop clicks close. Children stop propagation themselves.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClick?.();
      }}
      className={cn(
        'fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4',
        className,
      )}
    >
      {children}
    </div>
  );
}
