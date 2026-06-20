// src/components/ui/Avatar.tsx
import { cn } from '@/utils/cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

interface AvatarProps {
  name: string;
  src?: string | undefined;
  size?: AvatarSize | undefined;
  /** Square-ish avatar for groups (still rounded, but not a full circle). */
  square?: boolean | undefined;
  className?: string | undefined;
}

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
};

// Deterministic palette so the same name always gets the same colour.
const COLORS = [
  'bg-accent',
  'bg-online',
  'bg-idle',
  'bg-dnd',
  'bg-offline',
  'bg-bg-active',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return COLORS[Math.abs(hash) % COLORS.length]!;
}

/** Circular avatar with image or colored-initials fallback. */
export function Avatar({
  name,
  src,
  size = 'md',
  square = false,
  className,
}: AvatarProps) {
  const shape = square ? 'rounded-card' : 'rounded-avatar';

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn(
          'shrink-0 object-cover',
          shape,
          sizeClasses[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold text-white',
        shape,
        sizeClasses[size],
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
