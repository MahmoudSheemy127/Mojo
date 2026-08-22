// src/features/contacts/hooks/useConversationLiveUpdates.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useConversationLiveUpdates, conversationsKey } from './useConversations';
import { useAuthStore } from '@/store/authStore';
import {
  mockDmConversation,
  mockGroupConversation,
  mockUser,
} from '@/mocks/handlers';
import type { ApiMessage, Conversation } from '@/types/api';

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

function makeWrapper(route: string, qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

function makeIncomingMessage(
  overrides: Partial<ApiMessage> = {},
): ApiMessage {
  return {
    id: 'msg-new',
    conversationId: mockDmConversation.id,
    sequence: 2,
    senderId: mockDmConversation.otherUser.id,
    content: 'new message',
    attachments: [],
    status: 'sent',
    createdAt: '2026-08-22T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

function fire(event: string, payload: unknown) {
  const handlers = socketHandlers.get(event) ?? [];
  handlers.forEach((h) => h(payload));
}

describe('useConversationLiveUpdates', () => {
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

  it('bumps lastMessage + unread and reorders to top on message:new', () => {
    qc.setQueryData([...conversationsKey], [
      mockGroupConversation,
      mockDmConversation,
    ]);

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper('/c', qc),
    });

    const msg = makeIncomingMessage();
    act(() => fire('message:new', { message: msg }));

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data?.[0]?.id).toBe(mockDmConversation.id);
    expect(data?.[0]?.lastMessage?.id).toBe(msg.id);
    expect(data?.[0]?.lastActivityAt).toBe(msg.createdAt);
    expect(data?.[0]?.unreadCount).toBe(mockDmConversation.unreadCount + 1);
    expect(data?.[1]?.id).toBe(mockGroupConversation.id);
  });

  it('updates preview + reorders but does not bump unread for own messages', () => {
    qc.setQueryData([...conversationsKey], [
      mockGroupConversation,
      mockDmConversation,
    ]);

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper('/c', qc),
    });

    const msg = makeIncomingMessage({ senderId: mockUser.id });
    act(() => fire('message:new', { message: msg }));

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data?.[0]?.id).toBe(mockDmConversation.id);
    expect(data?.[0]?.lastMessage?.id).toBe(msg.id);
    expect(data?.[0]?.unreadCount).toBe(mockDmConversation.unreadCount);
  });

  it('does not bump unread when the conversation is active', () => {
    qc.setQueryData([...conversationsKey], [mockDmConversation]);

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper(`/c/${mockDmConversation.id}`, qc),
    });

    const msg = makeIncomingMessage();
    act(() => fire('message:new', { message: msg }));

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data?.[0]?.unreadCount).toBe(0);
    expect(data?.[0]?.lastMessage?.id).toBe(msg.id);
  });

  it('invalidates the list for an unknown conversation', () => {
    qc.setQueryData([...conversationsKey], [mockDmConversation]);
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper('/c', qc),
    });

    const msg = makeIncomingMessage({ conversationId: 'conv-unknown' });
    act(() => fire('message:new', { message: msg }));

    expect(spy).toHaveBeenCalledWith({ queryKey: conversationsKey });
  });

  it('invalidates the list when the lastMessage is deleted', () => {
    qc.setQueryData([...conversationsKey], [mockDmConversation]);
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper('/c', qc),
    });

    act(() =>
      fire('message:deleted', {
        conversationId: mockDmConversation.id,
        messageId: mockDmConversation.lastMessage?.id,
      }),
    );

    expect(spy).toHaveBeenCalledWith({ queryKey: conversationsKey });
  });

  it('does not invalidate when a non-last message is deleted', () => {
    qc.setQueryData([...conversationsKey], [mockDmConversation]);
    const spy = vi.spyOn(qc, 'invalidateQueries');

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper('/c', qc),
    });

    act(() =>
      fire('message:deleted', {
        conversationId: mockDmConversation.id,
        messageId: 'msg-some-other',
      }),
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it('resets unreadCount when the conversation is opened', () => {
    qc.setQueryData([...conversationsKey], [
      { ...mockDmConversation, unreadCount: 3 },
    ]);

    renderHook(() => useConversationLiveUpdates(), {
      wrapper: makeWrapper(`/c/${mockDmConversation.id}`, qc),
    });

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data?.[0]?.unreadCount).toBe(0);
  });
});
