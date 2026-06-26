// src/store/socketStore.ts
import { create } from 'zustand';

type SocketStatus = 'connected' | 'reconnecting' | 'disconnected';

interface SocketStore {
  status: SocketStatus;
  setStatus: (status: SocketStatus) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
  status: 'disconnected',
  setStatus: (status) => set({ status }),
}));
