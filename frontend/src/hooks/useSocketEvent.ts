// src/hooks/useSocketEvent.ts
// Typed, cleanup-safe socket event subscription.
import { useEffect, useRef } from 'react';
import { socket } from '@/hooks/useSocket';

import type { ServerToClientEvents } from '@/types/socket';

/** Subscribe to a typed server-to-client socket event; auto-cleans up on unmount. */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
) {
  // Keep the latest handler in a ref so a single, stable listener always invokes
  // the current closure. Without this, a handler that changes identity (e.g. one
  // that closes over conversationId) would never be re-bound — the socket would
  // keep calling the stale closure from a previous render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    // socket.io's FallbackToUntypedListener type doesn't distribute over a generic
    // K at the call-site, so we go through the untyped path deliberately.
    const listener = (...args: unknown[]) =>
      (handlerRef.current as (...a: unknown[]) => void)(...args);
    const rawOn = (socket.on as (e: string, h: unknown) => void).bind(socket);
    const rawOff = (socket.off as (e: string, h: unknown) => void).bind(socket);
    rawOn(event, listener);
    return () => {
      rawOff(event, listener);
    };
  }, [event]);
}
