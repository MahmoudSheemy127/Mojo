// src/features/chat/components/MessageHistory.tsx
import { useRef, useCallback, useEffect } from 'react';
import type { Message } from '@/types/entities';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyChatState } from './EmptyChatState';
import { MessageBubble } from './MessageBubble';

type HistoryState = 'loading' | 'empty' | 'ready';

interface MessageHistoryProps {
  messages: Message[];
  /** Name used by the empty state. */
  conversationName: string;
  state?: HistoryState | undefined;
  /** True while fetching an older page via infinite scroll. */
  isLoadingOlder?: boolean | undefined;
  /** True when there are more older messages to load. */
  hasOlderMessages?: boolean | undefined;
  onLoadOlder?: (() => void) | undefined;
  onDeleteMessage?: ((messageId: string) => void) | undefined;
  onRetryMessage?: ((clientNonce: string, content: string) => void) | undefined;
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
  isLoadingOlder = false,
  hasOlderMessages = false,
  onLoadOlder,
  onDeleteMessage,
  onRetryMessage,
}: MessageHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Pin to bottom on new messages when already scrolled to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !isAtBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Infinite scroll sentinel at the top
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0]?.isIntersecting && hasOlderMessages && !isLoadingOlder) {
        onLoadOlder?.();
      }
    },
    [hasOlderMessages, isLoadingOlder, onLoadOlder],
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(observerCallback, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [observerCallback]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  if (state === 'loading') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HistorySkeleton />
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex min-h-0 flex-1 flex-col overflow-y-auto"
    >
      {/* Top sentinel for infinite scroll (load older messages) */}
      <div ref={sentinelRef} className="h-1 shrink-0" />

      {isLoadingOlder && (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      )}

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
              onDelete={m.own ? () => onDeleteMessage?.(m.id) : undefined}
              onRetry={
                m.status === 'failed' && m.clientNonce
                  ? () => onRetryMessage?.(m.clientNonce!, m.body)
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
