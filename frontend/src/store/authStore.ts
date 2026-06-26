// src/store/authStore.ts
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SelfUser } from '@/types/api';

// In-memory fallback so the store works where Web Storage is absent
// (SSR, some test environments).
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => map.delete(key),
    setItem: (key, value) => map.set(key, value),
  };
}

const safeStorage: Storage =
  typeof localStorage !== 'undefined' ? localStorage : createMemoryStorage();

interface AuthState {
  currentUser: SelfUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: SelfUser, token: string) => void;
  setToken: (token: string) => void;
  /** Merge partial profile changes (presence, avatar, name, bio) into the
   *  current user so the persisted session stays in sync. No-op if signed out. */
  patchUser: (partial: Partial<SelfUser>) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      accessToken: null,
      isAuthenticated: false,
      setUser: (user, token) =>
        set({ currentUser: user, accessToken: token, isAuthenticated: true }),
      setToken: (token) => set({ accessToken: token }),
      patchUser: (partial) =>
        set((state) =>
          state.currentUser
            ? { currentUser: { ...state.currentUser, ...partial } }
            : {},
        ),
      clear: () =>
        set({ currentUser: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'mojo-auth',
      storage: createJSONStorage(() => safeStorage),
      // Persist the access token + user so the session survives refresh.
      // (The refresh token itself lives only in the httpOnly cookie.)
      partialize: (state) => ({
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
      }),
    },
  ),
);
