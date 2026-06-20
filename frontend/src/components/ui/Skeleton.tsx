// src/components/ui/Skeleton.tsx
import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string | undefined;
}

/** Animated placeholder block. Compose into row shapes via className. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn('block animate-pulse rounded-card bg-bg-active', className)}
    />
  );
}
