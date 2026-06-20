// src/components/ui/DropdownMenu.tsx
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface DropdownMenuItem {
  label: string;
  onSelect: () => void;
  variant?: 'default' | 'danger' | undefined;
  disabled?: boolean | undefined;
}

interface DropdownMenuProps {
  /** Trigger element rendered inline; clicking it toggles the menu. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: DropdownMenuItem[];
  align?: 'left' | 'right' | undefined;
  className?: string | undefined;
}

/** Anchored overflow (⋯) menu. Closes on outside-click, Esc, and selection. */
export function DropdownMenu({
  trigger,
  items,
  align = 'right',
  className,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-1 min-w-44 rounded-card border border-bg-deepest bg-bg-sidebar p-1 shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                'block w-full rounded-card px-3 py-1.5 text-left text-sm transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-50',
                item.variant === 'danger'
                  ? 'text-danger hover:bg-danger/10'
                  : 'text-text-normal hover:bg-bg-hover',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
