// src/features/chat/components/MessageHistory.tsx
import type { Message } from '@/types/entities';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyChatState } from './EmptyChatState';
import { MessageBubble } from './MessageBubble';

type HistoryState = 'loading' | 'empty' | 'ready';

interface MessageHistoryProps {
  messages: Message[];
  /** Name used by the empty state. */
  conversationName: string;
  state?: HistoryState | undefined;
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-10 w-10 rounded-avatar" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Scrollable message list, oldest→newest, newest pinned to the bottom. */
export function MessageHistory({
  messages,
  conversationName,
  state = 'ready',
}: MessageHistoryProps) {
  if (state === 'loading') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HistorySkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <EmptyChatState name={conversationName} />
      <div className="mt-auto pb-2">
        <div className="flex items-center gap-3 px-4 py-2">
          <span className="h-px flex-1 bg-bg-active" />
          <span className="text-xs text-text-muted">Today</span>
          <span className="h-px flex-1 bg-bg-active" />
        </div>
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showHeader = !prev || prev.authorId !== m.authorId;
          return (
            <MessageBubble
              key={m.id}
              message={m}
              showHeader={showHeader}
              onDelete={m.own ? () => {} : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
