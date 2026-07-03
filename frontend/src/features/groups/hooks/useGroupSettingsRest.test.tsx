// src/features/groups/hooks/useGroupSettingsRest.test.tsx
// Tests for the REST queries and mutations added in Stage 7.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import {
  useGroup,
  useGroupMembers,
  useUpdateGroup,
  useDeleteGroup,
  useChangeMemberRole,
  useRemoveMember,
} from './useGroupSettings';
import { server } from '@/mocks/server';
import { GROUP_ID, mockGroupMembers } from '@/mocks/handlers';

const API = 'http://localhost:4000/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

describe('useGroup', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockNavigate.mockClear();
  });

  it('fetches group detail successfully', async () => {
    const { result } = renderHook(() => useGroup(GROUP_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Design Guild');
  });

  it('enters error state on 404', async () => {
    server.use(
      http.get(`${API}/groups/:groupId`, () =>
        HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useGroup('nonexistent'), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useGroupMembers', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('fetches member list successfully', async () => {
    const { result } = renderHook(() => useGroupMembers(GROUP_ID), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.length).toBeGreaterThan(0);
  });
});

describe('useUpdateGroup', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockNavigate.mockClear();
  });

  it('updates the group and writes new data to cache', async () => {
    const { result } = renderHook(() => useUpdateGroup(GROUP_ID), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ name: 'Renamed Guild', description: null });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Renamed Guild');
  });

  it('enters error state on API failure', async () => {
    server.use(
      http.patch(`${API}/groups/:groupId`, () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'fail' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useUpdateGroup(GROUP_ID), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ name: 'fail' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useDeleteGroup', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockNavigate.mockClear();
  });

  it('deletes the group and navigates home', async () => {
    const { result } = renderHook(() => useDeleteGroup(GROUP_ID), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockNavigate).toHaveBeenCalledWith('/c');
  });
});

describe('useChangeMemberRole', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    // Pre-populate members cache so optimistic update has something to work with
    qc.setQueryData(['groups', GROUP_ID, 'members'], mockGroupMembers);
    mockNavigate.mockClear();
  });

  it('optimistically updates member role', async () => {
    const targetId = mockGroupMembers[1]!.user.id;
    const { result } = renderHook(() => useChangeMemberRole(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ userId: targetId, role: 'admin' });
    });

    // Optimistic update fires before the server response
    const cached = qc.getQueryData<typeof mockGroupMembers>(['groups', GROUP_ID, 'members']);
    const updated = cached?.find((m) => m.user.id === targetId);
    expect(updated?.role).toBe('admin');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back on error', async () => {
    server.use(
      http.patch(`${API}/groups/:groupId/members/:userId`, () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'fail' } }, { status: 500 }),
      ),
    );
    const targetId = mockGroupMembers[1]!.user.id;
    const { result } = renderHook(() => useChangeMemberRole(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate({ userId: targetId, role: 'admin' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // After rollback, original role should be restored
    const cached = qc.getQueryData<typeof mockGroupMembers>(['groups', GROUP_ID, 'members']);
    const restored = cached?.find((m) => m.user.id === targetId);
    expect(restored?.role).toBe('member');
  });
});

describe('useRemoveMember', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    qc.setQueryData(['groups', GROUP_ID, 'members'], mockGroupMembers);
    mockNavigate.mockClear();
  });

  it('removes member from cache on success', async () => {
    const targetId = mockGroupMembers[1]!.user.id;
    const { result } = renderHook(() => useRemoveMember(GROUP_ID), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate(targetId);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cached = qc.getQueryData<typeof mockGroupMembers>(['groups', GROUP_ID, 'members']);
    expect(cached?.some((m) => m.user.id === targetId)).toBe(false);
  });
});
