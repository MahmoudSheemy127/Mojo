// src/features/chat/components/MessageComposer.tsx
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { AttachmentPreview } from './AttachmentPreview';

interface MessageComposerProps {
  /** Name shown in the placeholder, e.g. "Message Aria". */
  recipientName: string;
  disabled?: boolean | undefined;
  /** Called with trimmed content when the user sends. */
  onSend?: ((content: string) => void) | undefined;
  /** Called on every keystroke (for typing events). */
  onTyping?: (() => void) | undefined;
  /** Called when the composer loses focus (to stop typing indicator). */
  onBlur?: (() => void) | undefined;
  /** When true, shows a blocked-DM notice instead of the input. */
  blocked?: boolean | undefined;
}

/**
 * Composer bar: attachment button (P3), multiline text box, send button.
 * Enter sends; Shift+Enter inserts a newline (FR-13).
 */
export function MessageComposer({
  recipientName,
  disabled = false,
  onSend,
  onTyping,
  onBlur,
  blocked = false,
}: MessageComposerProps) {
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = draft.trim().length > 0;

  function submit() {
    const content = draft.trim();
    if (!content || disabled || blocked) return;
    onSend?.(content);
    setDraft('');
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (blocked) {
    return (
      <div className="border-t border-bg-deepest bg-bg-chat px-4 py-3 text-center text-sm text-text-muted">
        You can&apos;t send messages to this conversation.
      </div>
    );
  }

  return (
    <div className="border-t border-bg-deepest bg-bg-chat">
      <AttachmentPreview attachments={[]} />
      <div className="flex items-end gap-2 p-3">
        <IconButton aria-label="Add attachment" disabled={disabled}>
          <span aria-hidden>📎</span>
        </IconButton>
        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          disabled={disabled}
          onChange={(e) => {
            setDraft(e.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          placeholder={`Message ${recipientName}`}
          aria-label={`Message ${recipientName}`}
          className="max-h-40 min-h-10 flex-1 resize-none rounded-card bg-bg-deepest px-3 py-2 text-sm text-text-normal placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button
          variant="primary"
          disabled={disabled || !canSend}
          onClick={submit}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
