// src/features/chat/hooks/useDeleteMessage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDeleteMessage } from './useDeleteMessage';
import { useMessages } from './useMessages';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/store/authStore';
import type { PublicUser } from '@/types/api';

vi.mock('@/lib/socket', () => ({
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false },
}));

const CONV_ID = 'conv-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockCurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null as string | null,
  bio: null as string | null,
  presence: 'online' as const,
  email: 'alice@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const participants = new Map<string, Pick<PublicUser, 'displayName' | 'avatarUrl'>>([
  [mockCurrentUser.id, { displayName: 'Alice', avatarUrl: null }],
]);

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useDeleteMessage', () => {
  it('optimistically marks message as deleted', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    const wrapper = makeWrapper();
    const { result: msgResult } = renderHook(
      () => useMessages(CONV_ID, participants),
      { wrapper },
    );
    await waitFor(() => expect(msgResult.current.isSuccess).toBe(true));

    const targetId = msgResult.current.messages[0]?.id;
    expect(targetId).toBeDefined();

    const { result: delResult } = renderHook(
      () => useDeleteMessage(CONV_ID),
      { wrapper },
    );

    act(() => { delResult.current.mutate(targetId!); });

    await waitFor(() =>
      expect(
        msgResult.current.messages.find((m) => m.id === targetId)?.deleted,
      ).toBe(true),
    );
  });

  it('rolls back on delete error', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    const API = 'http://localhost:4000/api';
    server.use(
      http.delete(`${API}/messages/:messageId`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'fail' } }, { status: 403 }),
      ),
    );

    const wrapper = makeWrapper();
    const { result: msgResult } = renderHook(
      () => useMessages(CONV_ID, participants),
      { wrapper },
    );
    await waitFor(() => expect(msgResult.current.isSuccess).toBe(true));
    const initialCount = msgResult.current.messages.length;

    const targetId = msgResult.current.messages[0]?.id;
    const { result: delResult } = renderHook(
      () => useDeleteMessage(CONV_ID),
      { wrapper },
    );

    act(() => { delResult.current.mutate(targetId!); });
    await waitFor(() => expect(delResult.current.isError).toBe(true));

    // Should roll back to undeleted state
    expect(msgResult.current.messages.length).toBe(initialCount);
    expect(
      msgResult.current.messages.find((m) => m.id === targetId)?.deleted,
    ).toBe(false);
  });
});
