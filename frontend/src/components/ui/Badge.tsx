// src/components/ui/Badge.tsx
import { cn } from '@/utils/cn';

interface BadgeProps {
  count: number;
  /** Maximum displayed before showing "N+". Defaults to 9. */
  max?: number | undefined;
  className?: string | undefined;
}

/** Count badge. Hides at zero, caps at `{max}+`. */
export function Badge({ count, max = 9, className }: BadgeProps) {
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);

  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-avatar bg-danger px-1.5 text-xs font-bold leading-5 text-white',
        className,
      )}
    >
      {label}
    </span>
  );
}
