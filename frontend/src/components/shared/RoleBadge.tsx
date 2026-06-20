// src/components/shared/RoleBadge.tsx
import type { Role } from '@/types/entities';
import { cn } from '@/utils/cn';

interface RoleBadgeProps {
  role: Role;
  className?: string | undefined;
}

/** "Admin" / "Member" pill for group member rows. */
export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-card px-1.5 py-0.5 text-xs font-medium',
        role === 'admin'
          ? 'bg-accent/20 text-accent'
          : 'bg-bg-active text-text-muted',
        className,
      )}
    >
      {role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}
