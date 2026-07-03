// src/features/presence/hooks/usePresenceFeed.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePresenceFeed } from './usePresenceFeed';
import { friendsKey } from '@/features/contacts/hooks/useContacts';
import type { PublicUser } from '@/types/api';

// Capture socket handlers so tests can fire them
const socketHandlers = new Map<string, ((...args: unknown[]) => void)[]>();

vi.mock('@/hooks/useSocket', () => ({
  socket: {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = socketHandlers.get(event) ?? [];
      list.push(handler);
      socketHandlers.set(event, list);
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      socketHandlers.set(
        event,
        (socketHandlers.get(event) ?? []).filter((h) => h !== handler),
      );
    }),
    emit: vi.fn(),
    connected: false,
  },
}));

const mockFriends: PublicUser[] = [
  {
    id: 'user-1',
    username: 'aria',
    displayName: 'Aria Chen',
    avatarUrl: null,
    bio: null,
    presence: 'online',
  },
  {
    id: 'user-2',
    username: 'ben',
    displayName: 'Ben Okafor',
    avatarUrl: null,
    bio: null,
    presence: 'away',
  },
];

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('usePresenceFeed', () => {
  let qc: QueryClient;

  beforeEach(() => {
    socketHandlers.clear();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    qc.setQueryData([...friendsKey], mockFriends);
  });

  it('updates presence in friends cache when presence:changed fires', () => {
    renderHook(() => usePresenceFeed(), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('presence:changed') ?? [];
      handlers.forEach((h) => h({ userId: 'user-1', status: 'dnd' }));
    });

    const friends = qc.getQueryData<PublicUser[]>([...friendsKey]);
    expect(friends?.find((f) => f.id === 'user-1')?.presence).toBe('dnd');
    // Other users are not affected
    expect(friends?.find((f) => f.id === 'user-2')?.presence).toBe('away');
  });

  it('ignores events for unknown user ids', () => {
    renderHook(() => usePresenceFeed(), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('presence:changed') ?? [];
      handlers.forEach((h) => h({ userId: 'unknown-user', status: 'offline' }));
    });

    const friends = qc.getQueryData<PublicUser[]>([...friendsKey]);
    expect(friends).toEqual(mockFriends);
  });

  it('does nothing when friends cache is empty', () => {
    qc.removeQueries({ queryKey: [...friendsKey] });

    renderHook(() => usePresenceFeed(), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('presence:changed') ?? [];
      handlers.forEach((h) => h({ userId: 'user-1', status: 'offline' }));
    });

    // No error and no data set
    const friends = qc.getQueryData<PublicUser[]>([...friendsKey]);
    expect(friends).toBeUndefined();
  });
});
