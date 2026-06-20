// src/features/chat/components/EmptyChatState.tsx
interface EmptyChatStateProps {
  name: string;
}

/** Shown at the top of a conversation with no message history yet. */
export function EmptyChatState({ name }: EmptyChatStateProps) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <p className="text-sm font-medium text-text-normal">
        This is the start of your conversation with {name}.
      </p>
      <p className="text-xs text-text-muted">Say hello 👋</p>
    </div>
  );
}
