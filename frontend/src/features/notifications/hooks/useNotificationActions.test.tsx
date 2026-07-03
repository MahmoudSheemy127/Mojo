// src/features/notifications/hooks/useNotificationActions.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useNotificationActions } from './useNotificationActions';
import { notificationsKey } from './useNotifications';
import type { Notification } from '@/types/entities';
import { server } from '@/mocks/server';

const API = 'http://localhost:4000/api';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function seedRow(qc: QueryClient, id: string) {
  const row: Notification = {
    id,
    kind: 'generic',
    actor: { id: 'a', username: 'a', displayName: 'A' },
    text: 't',
    createdAt: 'now',
    unread: true,
  };
  qc.setQueryData<Notification[]>(notificationsKey, [row]);
}

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('useNotificationActions — friend request', () => {
  it('accept resolves and removes the row from the feed cache', async () => {
    seedRow(qc, 'n1');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });

    act(() =>
      result.current.acceptFriendRequest.mutate({
        requestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        notifId: 'n1',
      }),
    );

    await waitFor(() =>
      expect(result.current.acceptFriendRequest.isSuccess).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0);
  });

  it('decline resolves and removes the row', async () => {
    seedRow(qc, 'n2');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });
    act(() =>
      result.current.declineFriendRequest.mutate({
        requestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        notifId: 'n2',
      }),
    );
    await waitFor(() =>
      expect(result.current.declineFriendRequest.isSuccess).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0);
  });

  it('surfaces an error and keeps the row when the request fails', async () => {
    server.use(
      http.post(`${API}/contacts/requests/:requestId/accept`, () =>
        HttpResponse.json(
          { error: { code: 'E', message: 'x' } },
          { status: 500 },
        ),
      ),
    );
    seedRow(qc, 'n3');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });
    act(() =>
      result.current.acceptFriendRequest.mutate({
        requestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        notifId: 'n3',
      }),
    );
    await waitFor(() =>
      expect(result.current.acceptFriendRequest.isError).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(1);
  });
});

describe('useNotificationActions — group invite', () => {
  it('accept resolves and removes the row', async () => {
    seedRow(qc, 'g1');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });
    act(() =>
      result.current.acceptGroupInvite.mutate({
        groupId: 'group-2222-2222-2222-222222222222',
        inviteId: 'inv-2222-2222-2222-222222222222',
        notifId: 'g1',
      }),
    );
    await waitFor(() =>
      expect(result.current.acceptGroupInvite.isSuccess).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0);
  });

  it('decline resolves and removes the row', async () => {
    seedRow(qc, 'g2');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });
    act(() =>
      result.current.declineGroupInvite.mutate({
        groupId: 'group-2222-2222-2222-222222222222',
        inviteId: 'inv-2222-2222-2222-222222222222',
        notifId: 'g2',
      }),
    );
    await waitFor(() =>
      expect(result.current.declineGroupInvite.isSuccess).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0);
  });
});

describe('useNotificationActions — join request', () => {
  it('accept resolves and removes the row', async () => {
    seedRow(qc, 'j1');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });
    act(() =>
      result.current.acceptJoinRequest.mutate({
        groupId: 'group-2222-2222-2222-222222222222',
        requestId: 'req-9999-9999-9999-999999999999',
        notifId: 'j1',
      }),
    );
    await waitFor(() =>
      expect(result.current.acceptJoinRequest.isSuccess).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0);
  });

  it('decline resolves and removes the row', async () => {
    seedRow(qc, 'j2');
    const { result } = renderHook(() => useNotificationActions(), {
      wrapper: makeWrapper(qc),
    });
    act(() =>
      result.current.declineJoinRequest.mutate({
        groupId: 'group-2222-2222-2222-222222222222',
        requestId: 'req-9999-9999-9999-999999999999',
        notifId: 'j2',
      }),
    );
    await waitFor(() =>
      expect(result.current.declineJoinRequest.isSuccess).toBe(true),
    );
    expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0);
  });
});
