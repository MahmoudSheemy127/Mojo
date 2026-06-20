// src/features/chat/components/AttachmentPreview.tsx
import { Chip } from '@/components/ui/Chip';

export interface PendingAttachment {
  id: string;
  name: string;
}

interface AttachmentPreviewProps {
  attachments: PendingAttachment[];
  onRemove?: ((id: string) => void) | undefined;
}

/** Pending attachment chips above the composer (FR-17, P3). */
export function AttachmentPreview({
  attachments,
  onRemove,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-4 pb-2">
      {attachments.map((a) => (
        <Chip key={a.id} onRemove={onRemove ? () => onRemove(a.id) : undefined}>
          📎 {a.name}
        </Chip>
      ))}
    </div>
  );
}
