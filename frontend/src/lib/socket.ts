// src/lib/socket.ts
// Typed Socket.io-client instance. autoConnect: false — Stage 6's useSocket
// hook connects it after the access token is available.
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket';

export const socket = io(
  import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:4000',
  {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket'],
  },
) as unknown as Socket<ServerToClientEvents, ClientToServerEvents>;
