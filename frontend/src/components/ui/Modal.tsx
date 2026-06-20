// src/components/ui/Modal.tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { Overlay } from './Overlay';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Accessible label for the dialog when no visible title is wired via aria. */
  'aria-label'?: string | undefined;
  className?: string | undefined;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Overlay + centered panel. Traps focus, closes on Esc and backdrop click.
 * Presentational only — open/close state is owned by the caller.
 */
export function Modal({
  open,
  onClose,
  children,
  'aria-label': ariaLabel,
  className,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    // Focus the first focusable element (or the panel) on open.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = focusables[0]!;
      const lastEl = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Overlay onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-modal bg-bg-sidebar shadow-xl',
          'focus:outline-none',
          className,
        )}
      >
        {children}
      </div>
    </Overlay>
  );
}
