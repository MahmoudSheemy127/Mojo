// src/hooks/useSocket.ts
// Connects/disconnects the socket when the access token changes.
// Handles reconnect → refetch to replay any missed events.
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

/**
 * Shared Socket.io-client singleton. Created once at module load.
 *
 * `autoConnect: false` — useSocket() connects it once the access token exists.
 * `auth` is a function so the JWT is read fresh from the auth store on every
 * (re)connect; the server's afterInit middleware verifies
 * socket.handshake.auth.token. This is the single instance every consumer
 * (useSocketEvent, useTyping, useReadReceipts, …) must import.
 */
export const socket = io(
  import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000',
  {
    autoConnect: false,
    withCredentials: true,
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
  },
) as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;

/** Connect the socket on mount (when authenticated) and disconnect on logout. */
export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setStatus = useSocketStore((s) => s.setStatus);
  const queryClient = useQueryClient();
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    if (!accessToken) {
      socket.disconnect();
      return;
    }

    socket.connect();

    const onConnect = () => {
      const isReconnect = hasConnectedRef.current;
      hasConnectedRef.current = true;
      setStatus('connected');

      if (isReconnect) {
        // Reconnect: invalidate messages + notification count so the cache
        // catches up on any events missed while disconnected.
        void queryClient.invalidateQueries({ queryKey: ['messages'] });
        void queryClient.invalidateQueries({
          queryKey: ['notifications', 'count'],
        });
      }
    };

    const onDisconnect = () => setStatus('disconnected');
    const onError = () => setStatus('reconnecting');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onError);
      socket.disconnect();
      hasConnectedRef.current = false;
    };
  }, [accessToken, setStatus, queryClient]);
}
