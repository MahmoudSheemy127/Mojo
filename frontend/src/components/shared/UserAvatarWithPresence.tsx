// src/components/shared/UserAvatarWithPresence.tsx
import { Avatar, type AvatarSize } from '@/components/ui/Avatar';
import type { Presence } from '@/types/entities';
import { cn } from '@/utils/cn';
import { PresenceDot } from './PresenceDot';

interface UserAvatarWithPresenceProps {
  name: string;
  src?: string | undefined;
  presence?: Presence | undefined;
  size?: AvatarSize | undefined;
  className?: string | undefined;
}

/** Avatar with a presence dot anchored bottom-right. */
export function UserAvatarWithPresence({
  name,
  src,
  presence,
  size = 'md',
  className,
}: UserAvatarWithPresenceProps) {
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      <Avatar name={name} src={src} size={size} />
      {presence && (
        <PresenceDot
          presence={presence}
          size={size === 'sm' ? 'sm' : 'md'}
          ring
          className="absolute bottom-0 right-0"
        />
      )}
    </span>
  );
}
