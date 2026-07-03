// src/features/chat/hooks/useSendMessage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSendMessage } from './useSendMessage';
import { useMessages } from './useMessages';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/store/authStore';
import type { PublicUser } from '@/types/api';

vi.mock('@/hooks/useSocket', () => ({
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false },
}));

const API = 'http://localhost:4000/api';
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

describe('useSendMessage', () => {
  it('adds an optimistic bubble immediately', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    // Delay server response so the optimistic 'sending' bubble is visible
    server.use(
      http.post(`${API}/conversations/:conversationId/messages`, async () => {
        await new Promise((r) => setTimeout(r, 100));
        const msg = {
          id: 'server-msg-1',
          conversationId: CONV_ID,
          senderId: mockCurrentUser.id,
          content: 'Hello!',
          contentType: 'text',
          clientNonce: 'nonce-1',
          status: 'sent',
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          attachments: [],
        };
        return HttpResponse.json(msg, { status: 201 });
      }),
    );

    const wrapper = makeWrapper();
    const { result: msgResult } = renderHook(
      () => useMessages(CONV_ID, participants),
      { wrapper },
    );
    await waitFor(() => expect(msgResult.current.isSuccess).toBe(true));
    const initialCount = msgResult.current.messages.length;

    const { result: sendResult } = renderHook(
      () => useSendMessage(CONV_ID),
      { wrapper },
    );

    act(() => {
      sendResult.current.mutate({ content: 'Hello!', clientNonce: 'nonce-1' });
    });

    // Optimistic bubble must appear before server responds (delayed 100ms)
    await waitFor(() =>
      expect(
        msgResult.current.messages.find((m) => m.status === 'sending'),
      ).toBeDefined(),
    );
    const optimistic = msgResult.current.messages.find(
      (m) => m.status === 'sending',
    );
    expect(optimistic?.body).toBe('Hello!');
    expect(optimistic?.own).toBe(true);
    expect(msgResult.current.messages.length).toBe(initialCount + 1);
  });

  it('replaces optimistic bubble with server message on success', async () => {
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

    const { result: sendResult } = renderHook(
      () => useSendMessage(CONV_ID),
      { wrapper },
    );

    act(() => {
      sendResult.current.mutate({ content: 'Test', clientNonce: 'nonce-2' });
    });

    await waitFor(() => expect(sendResult.current.isSuccess).toBe(true));

    // No 'sending' messages should remain
    const sending = msgResult.current.messages.filter(
      (m) => m.status === 'sending',
    );
    expect(sending).toHaveLength(0);
  });

  it('marks message as failed on send error', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    server.use(
      http.post(`${API}/conversations/:conversationId/messages`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'fail' } }, { status: 500 }),
      ),
    );

    const wrapper = makeWrapper();
    const { result: msgResult } = renderHook(
      () => useMessages(CONV_ID, participants),
      { wrapper },
    );
    await waitFor(() => expect(msgResult.current.isSuccess).toBe(true));

    const { result: sendResult } = renderHook(
      () => useSendMessage(CONV_ID),
      { wrapper },
    );

    act(() => {
      sendResult.current.mutate({ content: 'Oops', clientNonce: 'nonce-3' });
    });

    await waitFor(() => expect(sendResult.current.isError).toBe(true));

    const failed = msgResult.current.messages.find(
      (m) => m.status === 'failed',
    );
    expect(failed?.body).toBe('Oops');
  });
});
