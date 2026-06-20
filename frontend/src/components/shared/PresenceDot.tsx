// src/components/shared/PresenceDot.tsx
import type { Presence } from '@/types/entities';
import { cn } from '@/utils/cn';

interface PresenceDotProps {
  presence: Presence;
  size?: 'sm' | 'md' | undefined;
  /** When true, adds a ring matching the surface so it reads on an avatar. */
  ring?: boolean | undefined;
  className?: string | undefined;
}

const colorClasses: Record<Presence, string> = {
  online: 'bg-online',
  idle: 'bg-idle',
  dnd: 'bg-dnd',
  offline: 'bg-offline',
};

const label: Record<Presence, string> = {
  online: 'Online',
  idle: 'Away',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

/** Colored presence dot. Conveys status via `title` + sr-only text, not color alone. */
export function PresenceDot({
  presence,
  size = 'md',
  ring = false,
  className,
}: PresenceDotProps) {
  return (
    <span
      title={label[presence]}
      className={cn(
        'inline-block rounded-avatar',
        size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3',
        ring && 'ring-2 ring-bg-sidebar',
        colorClasses[presence],
        className,
      )}
    >
      <span className="sr-only">{label[presence]}</span>
    </span>
  );
}
