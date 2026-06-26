// src/hooks/useSocketEvent.ts
// Typed, cleanup-safe socket event subscription.
import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import type { ServerToClientEvents } from '@/types/socket';

/** Subscribe to a typed server-to-client socket event; auto-cleans up on unmount. */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K],
) {
  useEffect(() => {
    // socket.io's FallbackToUntypedListener type doesn't distribute over a generic
    // K at the call-site, so we go through the untyped path deliberately.
    const rawOn = (socket.on as (e: string, h: unknown) => void).bind(socket);
    const rawOff = (socket.off as (e: string, h: unknown) => void).bind(socket);
    rawOn(event, handler);
    return () => {
      rawOff(event, handler);
    };
    // handler identity must be stable — callers should memoize with useCallback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);
}
