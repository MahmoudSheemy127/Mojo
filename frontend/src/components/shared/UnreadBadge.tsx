// src/components/shared/UnreadBadge.tsx
import { Badge } from '@/components/ui/Badge';

interface UnreadBadgeProps {
  count: number;
  className?: string | undefined;
}

/** Unread-count chip for chat list rows. Thin wrapper over Badge. */
export function UnreadBadge({ count, className }: UnreadBadgeProps) {
  return <Badge count={count} className={className} />;
}
