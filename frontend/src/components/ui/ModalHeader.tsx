// src/components/ui/ModalHeader.tsx
import { cn } from '@/utils/cn';
import { IconButton } from './IconButton';

interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  className?: string | undefined;
}

/** Title + close button row for a Modal. */
export function ModalHeader({ title, onClose, className }: ModalHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-bg-deepest px-4 py-3',
        className,
      )}
    >
      <h2 className="text-base font-semibold text-text-normal">{title}</h2>
      <IconButton aria-label="Close" onClick={onClose}>
        <span aria-hidden className="text-lg leading-none">
          ✕
        </span>
      </IconButton>
    </div>
  );
}
