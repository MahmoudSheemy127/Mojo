// src/features/chat/components/TypingIndicator.tsx
interface TypingIndicatorProps {
  /** Names of people currently typing. */
  names: string[];
}

function label(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  return 'Several people are typing…';
}

/** Animated "<name> is typing…" shown just above the composer (FR-15). */
export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-1 text-xs text-text-muted">
      <span className="flex gap-0.5" aria-hidden>
        <span className="h-1.5 w-1.5 animate-bounce rounded-avatar bg-text-muted [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-avatar bg-text-muted [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-avatar bg-text-muted" />
      </span>
      {label(names)}
    </div>
  );
}
