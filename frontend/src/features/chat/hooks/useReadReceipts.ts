// src/features/chat/hooks/useReadReceipts.ts
import { useEffect, useRef } from 'react';
import { socket } from '@/lib/socket';
import { markConversationRead } from '@/features/chat/api';
import type { Message } from '@/types/entities';

/**
 * Emits read events when the conversation is viewed (FR-14).
 * Emits socket message:read and REST POST /conversations/:id/read
 * for the last visible message whenever it changes.
 */
export function useReadReceipts(conversationId: string, messages: Message[]) {
  const lastReadIdRef = useRef<string | null>(null);

  useEffect(() => {
    const lastOwnedByOther = [...messages]
      .reverse()
      .find((m) => !m.own && !m.deleted);

    if (!lastOwnedByOther) return;
    if (lastOwnedByOther.id === lastReadIdRef.current) return;

    lastReadIdRef.current = lastOwnedByOther.id;

    // Emit low-latency read marker over socket
    socket.emit('message:read', {
      conversationId,
      lastReadMessageId: lastOwnedByOther.id,
    });

    // Durable fallback via REST (handles reconnect gaps)
    void markConversationRead(conversationId, lastOwnedByOther.id);
  }, [conversationId, messages]);
}
