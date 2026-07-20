// src/features/notifications/hooks/useNotifications.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import {
  useNotifications,
  useNotificationSocket,
  useNotificationCount,
  useMarkNotificationsSeen,
  mapNotification,
  notificationsKey,
  notificationsCountKey,
} from './useNotifications';
import type { Notification } from '@/types/entities';
import type { SocketNotification } from '@/types/socket';
import { server } from '@/mocks/server';

const API = 'http://localhost:4000/api';

// Capture socket handlers so we can fire events at the hook under test.
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

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const mockSocketNotif: SocketNotification = {
  id: 'notif-socket-1111',
  type: 'friend_request',
  actor: {
    id: 'user-aaaa',
    username: 'aria',
    displayName: 'Aria Chen',
    avatarUrl: null,
    bio: null,
    presence: 'online',
  },
  read: false,
  createdAt: new Date().toISOString(),
  payload: { requestId: 'req-socket-1111' },
};

function fireEvent(event: string, payload: unknown) {
  const handlers = socketHandlers.get(event) ?? [];
  act(() => handlers.forEach((h) => h(payload)));
}

function emptyFeed() {
  server.use(
    http.get(`${API}/notifications`, () =>
      HttpResponse.json({ data: [], nextCursor: null }),
    ),
  );
}

describe('mapNotification', () => {
  it('maps payload ids and renders text by type', () => {
    const mapped = mapNotification({
      id: 'x',
      type: 'mention',
      read: true,
      createdAt: new Date().toISOString(),
      actor: null,
      payload: { conversationId: 'c1', messageId: 'm1', text: 'You were tagged' },
    });
    expect(mapped.kind).toBe('generic');
    expect(mapped.text).toBe('You were tagged');
    expect(mapped.conversationId).toBe('c1');
    expect(mapped.messageId).toBe('m1');
    expect(mapped.unread).toBe(false);
    expect(mapped.actor.displayName).toBe('Unknown');
  });
});

describe('useNotifications', () => {
  let qc: QueryClient;

  beforeEach(() => {
    socketHandlers.clear();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('loads and maps notifications from the REST feed', async () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(3);
    expect(result.current.data?.[0]?.kind).toBe('friend-request');
    expect(result.current.data?.[0]?.requestId).toBe(
      'req-1111-1111-1111-111111111111',
    );
    expect(result.current.data?.[1]?.kind).toBe('group-invite');
    expect(result.current.data?.[1]?.inviteId).toBe(
      'inv-2222-2222-2222-222222222222',
    );
  });

  it('surfaces the error state when the feed request fails', async () => {
    server.use(
      http.get(`${API}/notifications`, () =>
        HttpResponse.json(
          { error: { code: 'E', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );
    const { result } = renderHook(() => useNotifications(), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('prepends a notification on notification:new and bumps the count', async () => {
    emptyFeed();
    const { result } = renderHook(
      () => {
        useNotificationSocket();
        return useNotifications();
      },
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    fireEvent('notification:new', { notification: mockSocketNotif });

    const data = qc.getQueryData<Notification[]>([...notificationsKey]);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(mockSocketNotif.id);
    expect(data?.[0]?.kind).toBe('friend-request');
    expect(qc.getQueryData<number>(notificationsCountKey)).toBe(1);
  });

  it('maps group_invite and group_join_request kinds from the socket', async () => {
    emptyFeed();
    renderHook(() => useNotificationSocket(), { wrapper: makeWrapper(qc) });

    fireEvent('notification:new', {
      notification: { ...mockSocketNotif, id: 'gi', type: 'group_invite' },
    });
    fireEvent('notification:new', {
      notification: { ...mockSocketNotif, id: 'jr', type: 'group_join_request' },
    });

    const data = qc.getQueryData<Notification[]>([...notificationsKey]);
    expect(data?.find((n) => n.id === 'gi')?.kind).toBe('group-invite');
    expect(data?.find((n) => n.id === 'jr')?.kind).toBe('join-request');
  });
});

describe('useNotificationCount', () => {
  let qc: QueryClient;

  beforeEach(() => {
    socketHandlers.clear();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('loads the unseen count from /notifications/count', async () => {
    const { result } = renderHook(() => useNotificationCount(), {
      wrapper: makeWrapper(qc),
    });
    await waitFor(() => expect(result.current).toBe(2));
  });

  it('returns 0 before the count resolves', () => {
    const { result } = renderHook(() => useNotificationCount(), {
      wrapper: makeWrapper(qc),
    });
    expect(result.current).toBe(0);
  });
});

describe('useMarkNotificationsSeen', () => {
  let qc: QueryClient;

  beforeEach(() => {
    socketHandlers.clear();
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('optimistically clears the badge count to 0', async () => {
    qc.setQueryData<number>(notificationsCountKey, 5);
    const { result } = renderHook(() => useMarkNotificationsSeen(), {
      wrapper: makeWrapper(qc),
    });

    act(() => result.current.mutate(undefined));
    expect(qc.getQueryData<number>(notificationsCountKey)).toBe(0);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData<number>(notificationsCountKey)).toBe(0);
  });

  it('rolls the count back if the request fails', async () => {
    server.use(
      http.post(`${API}/notifications/seen`, () =>
        HttpResponse.json(
          { error: { code: 'E', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );
    qc.setQueryData<number>(notificationsCountKey, 7);
    const { result } = renderHook(() => useMarkNotificationsSeen(), {
      wrapper: makeWrapper(qc),
    });

    act(() => result.current.mutate(undefined));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(qc.getQueryData<number>(notificationsCountKey)).toBe(7);
  });
});
