// src/features/chat/hooks/useTyping.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { socket } from '@/lib/socket';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { useAuthStore } from '@/store/authStore';

const TYPING_THROTTLE_MS = 2000;
const TYPING_IDLE_MS = 3000;

interface UseTypingReturn {
  /** Names currently typing in this conversation (excludes self). */
  typingNames: string[];
  /** Call on every keystroke in the composer to emit typing events. */
  onKeyPress: () => void;
  /** Call on blur or message send to stop the typing indicator. */
  onStop: () => void;
}

/**
 * Debounced typing events (FR-15).
 * Emits typing:start on first keystroke (throttled), typing:stop on idle/blur/send.
 */
export function useTyping(
  conversationId: string,
  /** Map of userId → displayName for naming the typing indicator. */
  participants: Map<string, string>,
): UseTypingReturn {
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const lastEmitRef = useRef<number>(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitStop = useCallback(() => {
    socket.emit('typing:stop', { conversationId });
    lastEmitRef.current = 0;
  }, [conversationId]);

  const onKeyPress = useCallback(() => {
    const now = Date.now();
    if (now - lastEmitRef.current > TYPING_THROTTLE_MS) {
      socket.emit('typing:start', { conversationId });
      lastEmitRef.current = now;
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(emitStop, TYPING_IDLE_MS);
  }, [conversationId, emitStop]);

  const onStop = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    emitStop();
  }, [emitStop]);

  // Clean up on unmount
  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    [],
  );

  // socket: someone started typing
  const onTypingStart = useCallback(
    (payload: { conversationId: string; userId: string }) => {
      if (
        payload.conversationId !== conversationId ||
        payload.userId === currentUserId
      )
        return;
      setTypingUserIds((prev) => new Set([...prev, payload.userId]));
    },
    [conversationId, currentUserId],
  );
  useSocketEvent('typing:start', onTypingStart);

  // socket: someone stopped typing
  const onTypingStop = useCallback(
    (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId !== conversationId) return;
      setTypingUserIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.userId);
        return next;
      });
    },
    [conversationId],
  );
  useSocketEvent('typing:stop', onTypingStop);

  const typingNames = [...typingUserIds]
    .map((id) => participants.get(id) ?? id)
    .filter(Boolean);

  return { typingNames, onKeyPress, onStop };
}
