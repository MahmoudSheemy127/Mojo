// src/features/groups/hooks/useGroupSettings.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGroupSettings, groupKey, groupMembersKey } from './useGroupSettings';
import { useAuthStore } from '@/store/authStore';

// Capture socket handlers
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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const GROUP_ID = 'group-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CURRENT_USER_ID = '11111111-1111-1111-1111-111111111111';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    );
  };
}

describe('useGroupSettings', () => {
  let qc: QueryClient;

  beforeEach(() => {
    socketHandlers.clear();
    mockNavigate.mockClear();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({
      currentUser: {
        id: CURRENT_USER_ID,
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

  it('invalidates group query when group:updated fires for matching group', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useGroupSettings(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('group:updated') ?? [];
      handlers.forEach((h) => h({ group: { id: GROUP_ID, name: 'Updated' } }));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupKey(GROUP_ID),
    });
  });

  it('ignores group:updated for a different group', () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useGroupSettings(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('group:updated') ?? [];
      handlers.forEach((h) => h({ group: { id: 'other-group-id', name: 'Other' } }));
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('invalidates members query when member:removed fires for matching group', () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useGroupSettings(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('member:removed') ?? [];
      handlers.forEach((h) =>
        h({ groupId: GROUP_ID, userId: 'other-user-id' }),
      );
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupMembersKey(GROUP_ID),
    });
    // Not the current user — no navigation
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates to /c when current user is removed from the group', () => {
    renderHook(() => useGroupSettings(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('member:removed') ?? [];
      handlers.forEach((h) =>
        h({ groupId: GROUP_ID, userId: CURRENT_USER_ID }),
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith('/c');
  });

  it('ignores member:removed for a different group', () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useGroupSettings(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('member:removed') ?? [];
      handlers.forEach((h) =>
        h({ groupId: 'other-group', userId: CURRENT_USER_ID }),
      );
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('updates members cache when member:role_changed fires', () => {
    const OTHER_USER_ID = 'other-user-id';
    qc.setQueryData(groupMembersKey(GROUP_ID), [
      { user: { id: OTHER_USER_ID, displayName: 'Bob', username: 'bob', avatarUrl: null, bio: null, presence: 'online' }, role: 'member', joinedAt: '2026-01-01T00:00:00Z' },
    ]);

    renderHook(() => useGroupSettings(GROUP_ID), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('member:role_changed') ?? [];
      handlers.forEach((h) =>
        h({ groupId: GROUP_ID, userId: OTHER_USER_ID, role: 'admin' }),
      );
    });

    const cached = qc.getQueryData<{ user: { id: string }; role: string }[]>(groupMembersKey(GROUP_ID));
    expect(cached?.find((m) => m.user.id === OTHER_USER_ID)?.role).toBe('admin');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls onDemoted when current user is demoted via member:role_changed', () => {
    const onDemoted = vi.fn();
    renderHook(() => useGroupSettings(GROUP_ID, { onDemoted }), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('member:role_changed') ?? [];
      handlers.forEach((h) =>
        h({ groupId: GROUP_ID, userId: CURRENT_USER_ID, role: 'member' }),
      );
    });

    expect(onDemoted).toHaveBeenCalled();
  });

  it('ignores member:role_changed for a different group', () => {
    const onDemoted = vi.fn();
    renderHook(() => useGroupSettings(GROUP_ID, { onDemoted }), {
      wrapper: makeWrapper(qc),
    });

    act(() => {
      const handlers = socketHandlers.get('member:role_changed') ?? [];
      handlers.forEach((h) =>
        h({ groupId: 'other-group', userId: CURRENT_USER_ID, role: 'member' }),
      );
    });

    expect(onDemoted).not.toHaveBeenCalled();
  });

  it('navigates to /c when group:deleted fires for matching group', () => {
    renderHook(() => useGroupSettings(GROUP_ID), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('group:deleted') ?? [];
      handlers.forEach((h) => h({ groupId: GROUP_ID }));
    });

    expect(mockNavigate).toHaveBeenCalledWith('/c');
  });

  it('ignores group:deleted for a different group', () => {
    renderHook(() => useGroupSettings(GROUP_ID), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('group:deleted') ?? [];
      handlers.forEach((h) => h({ groupId: 'other-group' }));
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('invalidates members cache when member:added fires for matching group', () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useGroupSettings(GROUP_ID), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('member:added') ?? [];
      handlers.forEach((h) =>
        h({ groupId: GROUP_ID, member: { user: { id: 'new-user' } } }),
      );
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: groupMembersKey(GROUP_ID),
    });
  });

  it('ignores member:added for a different group', () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    renderHook(() => useGroupSettings(GROUP_ID), { wrapper: makeWrapper(qc) });

    act(() => {
      const handlers = socketHandlers.get('member:added') ?? [];
      handlers.forEach((h) =>
        h({ groupId: 'other-group', member: { user: { id: 'new-user' } } }),
      );
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
