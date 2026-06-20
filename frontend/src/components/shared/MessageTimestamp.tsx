// src/components/shared/MessageTimestamp.tsx
import { cn } from '@/utils/cn';

interface MessageTimestampProps {
  /** Pre-formatted relative label, e.g. "2 min ago". */
  relative: string;
  /** Absolute ISO timestamp, surfaced on hover. */
  iso?: string | undefined;
  className?: string | undefined;
}

/**
 * Relative timestamp with the absolute value on hover. Formatting is done by
 * the caller for now; a live formatter (formatDate util) lands with the data layer.
 */
export function MessageTimestamp({
  relative,
  iso,
  className,
}: MessageTimestampProps) {
  return (
    <time
      {...(iso ? { dateTime: iso, title: iso } : {})}
      className={cn('text-xs text-text-muted', className)}
    >
      {relative}
    </time>
  );
}
