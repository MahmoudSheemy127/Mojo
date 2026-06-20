// src/features/chat/components/MessageStatusIcon.tsx
import type { MessageStatus } from '@/types/entities';
import { cn } from '@/utils/cn';

interface MessageStatusIconProps {
  status: MessageStatus;
  className?: string | undefined;
}

const config: Record<MessageStatus, { glyph: string; label: string; read: boolean }> =
  {
    sending: { glyph: '🕓', label: 'Sending', read: false },
    sent: { glyph: '✓', label: 'Sent', read: false },
    delivered: { glyph: '✓✓', label: 'Delivered', read: false },
    read: { glyph: '✓✓', label: 'Read', read: true },
  };

/** Delivery indicator for own messages (FR-14). */
export function MessageStatusIcon({ status, className }: MessageStatusIconProps) {
  const { glyph, label, read } = config[status];
  return (
    <span
      title={label}
      className={cn('text-xs', read ? 'text-accent' : 'text-text-muted', className)}
    >
      <span aria-hidden>{glyph}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
