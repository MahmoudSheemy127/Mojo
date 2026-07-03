// src/features/chat/hooks/useTyping.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTyping } from './useTyping';
import { useAuthStore } from '@/store/authStore';

// We need to capture socket event handlers so we can call them in tests
const socketHandlers = new Map<string, ((...args: unknown[]) => void)[]>();

vi.mock('@/hooks/useSocket', () => ({
  socket: {
    emit: vi.fn(),
    connected: false,
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = socketHandlers.get(event) ?? [];
      handlers.push(handler);
      socketHandlers.set(event, handlers);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const handlers = socketHandlers.get(event) ?? [];
      socketHandlers.set(
        event,
        handlers.filter((h) => h !== handler),
      );
    }),
  },
}));

const CONV_ID = 'conv-1';
const OTHER_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const participants = new Map<string, string>([
  [OTHER_USER_ID, 'Aria Chen'],
]);

beforeEach(() => {
  socketHandlers.clear();
  useAuthStore.setState({
    currentUser: {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'alice',
      displayName: 'Alice',
      avatarUrl: null,
      bio: null,
      presence: 'online',
      email: 'alice@example.com',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'tok',
    isAuthenticated: true,
  });
});

describe('useTyping', () => {
  it('returns empty typingNames initially', () => {
    const { result } = renderHook(() => useTyping(CONV_ID, participants));
    expect(result.current.typingNames).toEqual([]);
  });

  it('adds typing name when typing:start fires for another user', () => {
    const { result } = renderHook(() => useTyping(CONV_ID, participants));

    act(() => {
      const handlers = socketHandlers.get('typing:start') ?? [];
      handlers.forEach((h) =>
        h({ conversationId: CONV_ID, userId: OTHER_USER_ID }),
      );
    });

    expect(result.current.typingNames).toContain('Aria Chen');
  });

  it('removes typing name when typing:stop fires', () => {
    const { result } = renderHook(() => useTyping(CONV_ID, participants));

    act(() => {
      const startHandlers = socketHandlers.get('typing:start') ?? [];
      startHandlers.forEach((h) =>
        h({ conversationId: CONV_ID, userId: OTHER_USER_ID }),
      );
    });

    act(() => {
      const stopHandlers = socketHandlers.get('typing:stop') ?? [];
      stopHandlers.forEach((h) =>
        h({ conversationId: CONV_ID, userId: OTHER_USER_ID }),
      );
    });

    expect(result.current.typingNames).toEqual([]);
  });

  it('ignores typing:start from self', () => {
    const { result } = renderHook(() => useTyping(CONV_ID, participants));

    act(() => {
      const handlers = socketHandlers.get('typing:start') ?? [];
      handlers.forEach((h) =>
        h({
          conversationId: CONV_ID,
          userId: '11111111-1111-1111-1111-111111111111',
        }),
      );
    });

    expect(result.current.typingNames).toEqual([]);
  });

  it('ignores events for other conversations', () => {
    const { result } = renderHook(() => useTyping(CONV_ID, participants));

    act(() => {
      const handlers = socketHandlers.get('typing:start') ?? [];
      handlers.forEach((h) =>
        h({ conversationId: 'other-conv', userId: OTHER_USER_ID }),
      );
    });

    expect(result.current.typingNames).toEqual([]);
  });
});
