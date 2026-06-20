// src/components/ui/Popover.tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  /** The clickable trigger; the panel anchors relative to this. */
  trigger: ReactNode;
  children: ReactNode;
  /** Horizontal alignment of the panel under the trigger. */
  align?: 'left' | 'right' | undefined;
  className?: string | undefined;
}

/**
 * Anchored floating panel (profile popup, notification dropdown). Closes on
 * outside-click and Esc. Positioning is a simple absolute offset — good enough
 * for header-anchored menus without a positioning library.
 */
export function Popover({
  open,
  onClose,
  trigger,
  children,
  align = 'right',
  className,
}: PopoverProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-2 min-w-56 rounded-modal border border-bg-deepest bg-bg-sidebar p-1 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
