// src/features/chat/components/MessageComposer.tsx
import { useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { AttachmentPreview } from './AttachmentPreview';

interface MessageComposerProps {
  /** Name shown in the placeholder, e.g. "Message Aria". */
  recipientName: string;
  disabled?: boolean | undefined;
}

/**
 * Text input + attachment + send. Local draft state only; sending is wired with
 * the message mutation later. Enter would send / Shift+Enter newline once wired.
 */
export function MessageComposer({
  recipientName,
  disabled = false,
}: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const canSend = draft.trim().length > 0;

  return (
    <div className="border-t border-bg-deepest bg-bg-chat">
      <AttachmentPreview attachments={[]} />
      <div className="flex items-end gap-2 p-3">
        <IconButton aria-label="Add attachment" disabled={disabled}>
          <span aria-hidden>📎</span>
        </IconButton>
        <textarea
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            disabled ? 'You can’t message this conversation' : `Message ${recipientName}`
          }
          aria-label={`Message ${recipientName}`}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-card bg-bg-deepest px-3 py-2 text-sm text-text-normal placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button variant="primary" disabled={disabled || !canSend}>
          Send
        </Button>
      </div>
    </div>
  );
}
