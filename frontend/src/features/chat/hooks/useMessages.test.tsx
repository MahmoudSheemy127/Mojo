// src/features/chat/hooks/useMessages.test.tsx
import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMessages } from './useMessages';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/store/authStore';
import type { ApiMessage } from '@/types/api';
import type { PublicUser } from '@/types/api';

vi.mock('@/hooks/useSocket', () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connected: false,
  },
}));

const API = 'http://localhost:4000/api';
const CONV_ID = 'conv-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const mockCurrentUser = {
  id: '11111111-1111-1111-1111-111111111111',
  username: 'alice',
  displayName: 'Alice',
  avatarUrl: null,
  bio: null,
  presence: 'online' as const,
  email: 'alice@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const mockOtherUser: PublicUser = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  username: 'aria',
  displayName: 'Aria Chen',
  avatarUrl: null,
  bio: null,
  presence: 'online',
};

const participants = new Map<string, Pick<PublicUser, 'displayName' | 'avatarUrl'>>([
  [mockCurrentUser.id, { displayName: 'Alice', avatarUrl: null }],
  [mockOtherUser.id, { displayName: 'Aria Chen', avatarUrl: null }],
]);

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useMessages', () => {
  it('fetches messages and maps to view model', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    const { result } = renderHook(() => useMessages(CONV_ID, participants), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { messages } = result.current;
    expect(messages.length).toBeGreaterThan(0);
    // own message maps correctly
    const ownMsg = messages.find((m) => m.own);
    expect(ownMsg).toBeDefined();
    expect(ownMsg?.authorName).toBe('Alice');
    // other user's message
    const otherMsg = messages.find((m) => !m.own);
    expect(otherMsg?.authorName).toBe('Aria Chen');
    expect(otherMsg?.own).toBe(false);
  });

  it('treats soft-deleted messages as deleted', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    const deletedMsg: ApiMessage = {
      id: 'msg-deleted',
      conversationId: CONV_ID,
      sequence: 99,
      senderId: mockOtherUser.id,
      content: null,
      attachments: [],
      status: 'read',
      createdAt: new Date().toISOString(),
      deletedAt: new Date().toISOString(),
    };

    server.use(
      http.get(`${API}/conversations/:conversationId/messages`, () =>
        HttpResponse.json({ data: [deletedMsg], nextCursor: null }),
      ),
    );

    const { result } = renderHook(() => useMessages(CONV_ID, participants), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const deleted = result.current.messages.find((m) => m.id === 'msg-deleted');
    expect(deleted?.deleted).toBe(true);
  });

  it('enters error state on API failure', async () => {
    server.use(
      http.get(`${API}/conversations/:conversationId/messages`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'oops' } }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useMessages(CONV_ID, participants), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('uses senderId as fallback when participant not in map', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    const unknownMsg: ApiMessage = {
      id: 'msg-unknown',
      conversationId: CONV_ID,
      sequence: 5,
      senderId: 'unknown-user-id',
      content: 'Hello',
      attachments: [],
      status: 'read',
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };

    server.use(
      http.get(`${API}/conversations/:conversationId/messages`, () =>
        HttpResponse.json({ data: [unknownMsg], nextCursor: null }),
      ),
    );

    const { result } = renderHook(() => useMessages(CONV_ID, new Map()), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const msg = result.current.messages[0];
    expect(msg?.authorName).toBe('unknown-user-id');
  });

  it('flattens pages in oldest→newest order', async () => {
    useAuthStore.setState({
      currentUser: mockCurrentUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });

    const oldMsg: ApiMessage = {
      id: 'msg-old',
      conversationId: CONV_ID,
      sequence: 1,
      senderId: mockOtherUser.id,
      content: 'Old message',
      attachments: [],
      status: 'read',
      createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      deletedAt: null,
    };
    const newMsg: ApiMessage = {
      id: 'msg-new',
      conversationId: CONV_ID,
      sequence: 2,
      senderId: mockCurrentUser.id,
      content: 'New message',
      attachments: [],
      status: 'sent',
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      deletedAt: null,
    };

    server.use(
      http.get(`${API}/conversations/:conversationId/messages`, ({ request }) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get('cursor');
        if (cursor === 'older') {
          return HttpResponse.json({ data: [oldMsg], nextCursor: null });
        }
        return HttpResponse.json({ data: [newMsg], nextCursor: 'older' });
      }),
    );

    const { result } = renderHook(() => useMessages(CONV_ID, participants), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Load older page
    act(() => { void result.current.fetchNextPage(); });
    await waitFor(() => expect(result.current.messages.length).toBe(2));

    // Should be oldest first
    expect(result.current.messages[0]?.id).toBe('msg-old');
    expect(result.current.messages[1]?.id).toBe('msg-new');
  });
});
