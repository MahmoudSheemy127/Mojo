// src/features/chat/hooks/useMessageLiveUpdates.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { useMessageLiveUpdates } from './useMessageLiveUpdates';
import { messagesKey } from './useMessages';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from '@/mocks/handlers';
import type { ApiMessage, MessagesListResponse } from '@/types/api';

type MessagesData = InfiniteData<MessagesListResponse>;

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

const CONV_ID = 'conv-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OTHER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeMessage(overrides: Partial<ApiMessage> = {}): ApiMessage {
  return {
    id: 'msg-new',
    conversationId: CONV_ID,
    sequence: 2,
    senderId: OTHER_ID,
    content: 'hello',
    attachments: [],
    status: 'sent',
    createdAt: '2026-08-22T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function makeData(messages: ApiMessage[]): MessagesData {
  return {
    pages: [{ data: messages, nextCursor: null }],
    pageParams: [undefined],
  };
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function fire(event: string, payload: unknown) {
  (socketHandlers.get(event) ?? []).forEach((h) => h(payload));
}

describe('useMessageLiveUpdates', () => {
  let qc: QueryClient;

  beforeEach(() => {
    socketHandlers.clear();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAuthStore.setState({
      currentUser: mockUser,
      accessToken: 'tok',
      isAuthenticated: true,
    });
  });

  it('appends message:new to the correct conversation cache', () => {
    const existing = makeMessage({ id: 'msg-1', sequence: 1 });
    qc.setQueryData<MessagesData>(messagesKey(CONV_ID), makeData([existing]));

    renderHook(() => useMessageLiveUpdates(), { wrapper: makeWrapper(qc) });

    const msg = makeMessage();
    act(() => fire('message:new', { message: msg }));

    const data = qc.getQueryData<MessagesData>(messagesKey(CONV_ID));
    expect(data?.pages[0]?.data.map((m) => m.id)).toEqual(['msg-1', 'msg-new']);
  });

  it('skips the current user’s own messages', () => {
    const existing = makeMessage({ id: 'msg-1', sequence: 1 });
    qc.setQueryData<MessagesData>(messagesKey(CONV_ID), makeData([existing]));

    renderHook(() => useMessageLiveUpdates(), { wrapper: makeWrapper(qc) });

    const msg = makeMessage({ senderId: mockUser.id });
    act(() => fire('message:new', { message: msg }));

    const data = qc.getQueryData<MessagesData>(messagesKey(CONV_ID));
    expect(data?.pages[0]?.data.map((m) => m.id)).toEqual(['msg-1']);
  });

  it('does not duplicate an already-present message', () => {
    const existing = makeMessage({ id: 'msg-1', sequence: 1 });
    qc.setQueryData<MessagesData>(messagesKey(CONV_ID), makeData([existing]));

    renderHook(() => useMessageLiveUpdates(), { wrapper: makeWrapper(qc) });

    const msg = makeMessage({ id: 'msg-1' });
    act(() => fire('message:new', { message: msg }));

    const data = qc.getQueryData<MessagesData>(messagesKey(CONV_ID));
    expect(data?.pages[0]?.data).toHaveLength(1);
  });

  it('patches the deleted message in cache', () => {
    const existing = makeMessage({ id: 'msg-1', sequence: 1 });
    qc.setQueryData<MessagesData>(messagesKey(CONV_ID), makeData([existing]));

    renderHook(() => useMessageLiveUpdates(), { wrapper: makeWrapper(qc) });

    act(() =>
      fire('message:deleted', { conversationId: CONV_ID, messageId: 'msg-1' }),
    );

    const data = qc.getQueryData<MessagesData>(messagesKey(CONV_ID));
    const msg = data?.pages[0]?.data[0];
    expect(msg?.content).toBeNull();
    expect(msg?.deletedAt).not.toBeNull();
  });

  it('patches the message status in cache', () => {
    const existing = makeMessage({ id: 'msg-1', sequence: 1, status: 'sent' });
    qc.setQueryData<MessagesData>(messagesKey(CONV_ID), makeData([existing]));

    renderHook(() => useMessageLiveUpdates(), { wrapper: makeWrapper(qc) });

    act(() =>
      fire('message:status', {
        conversationId: CONV_ID,
        messageId: 'msg-1',
        status: 'read',
        userId: OTHER_ID,
      }),
    );

    const data = qc.getQueryData<MessagesData>(messagesKey(CONV_ID));
    expect(data?.pages[0]?.data[0]?.status).toBe('read');
  });
});
