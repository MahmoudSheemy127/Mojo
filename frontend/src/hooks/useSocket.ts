// src/hooks/useSocket.ts
// Connects/disconnects the socket when the access token changes.
// Mount this once at the authenticated app root (Stage 6 wires this fully).
import { useEffect } from 'react';
import { socket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';

/** Connect the socket on mount (when authenticated) and disconnect on logout. */
export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setStatus = useSocketStore((s) => s.setStatus);

  useEffect(() => {
    if (!accessToken) {
      socket.disconnect();
      return;
    }

    (socket.auth as Record<string, string>).token = accessToken;
    socket.connect();

    const onConnect = () => setStatus('connected');
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
    };
  }, [accessToken, setStatus]);
}
