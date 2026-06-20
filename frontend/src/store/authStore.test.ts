// src/store/authStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './authStore';
import { mockUser } from '@/mocks/handlers';

describe('authStore', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('starts unauthenticated', () => {
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
    expect(s.currentUser).toBeNull();
  });

  it('setUser stores user + token and marks authenticated', () => {
    useAuthStore.getState().setUser(mockUser, 'tok');
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(true);
    expect(s.accessToken).toBe('tok');
    expect(s.currentUser?.username).toBe('alice');
  });

  it('setToken updates only the token', () => {
    useAuthStore.getState().setUser(mockUser, 'tok');
    useAuthStore.getState().setToken('tok2');
    expect(useAuthStore.getState().accessToken).toBe('tok2');
    expect(useAuthStore.getState().currentUser?.username).toBe('alice');
  });

  it('clear resets the session', () => {
    useAuthStore.getState().setUser(mockUser, 'tok');
    useAuthStore.getState().clear();
    const s = useAuthStore.getState();
    expect(s.isAuthenticated).toBe(false);
    expect(s.accessToken).toBeNull();
  });
});
