// src/features/contacts/hooks/useConversations.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '@/test/render';
import { useConversations, conversationsKey } from './useConversations';
import { server } from '@/mocks/server';
import {
  mockDmConversation,
  mockGroupConversation,
} from '@/mocks/handlers';
import type { Conversation } from '@/types/api';

const API = 'http://localhost:4000/api';

// Capture socket event handlers for socket-behaviour tests
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

function ConversationList() {
  const { data, isLoading, isError } = useConversations();
  if (isLoading) return <div>loading</div>;
  if (isError) return <div>error</div>;
  return (
    <ul>
      {(data ?? []).map((c) => (
        <li key={c.id}>
          {c.type === 'dm' ? c.otherUser.displayName : c.name}
        </li>
      ))}
    </ul>
  );
}

describe('useConversations — REST query', () => {
  beforeEach(() => socketHandlers.clear());

  it('returns the conversation list on success', async () => {
    renderWithProviders(<ConversationList />, { route: '/c' });
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(mockDmConversation.otherUser.displayName),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(mockGroupConversation.name)).toBeInTheDocument();
  });

  it('exposes isError when the request fails', async () => {
    server.use(
      http.get(`${API}/conversations`, () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'oops' } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<ConversationList />, { route: '/c' });
    await waitFor(() =>
      expect(screen.getByText('error')).toBeInTheDocument(),
    );
  });
});

describe('useConversations — conversation:new socket event', () => {
  let qc: QueryClient;

  function makeWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <MemoryRouter>
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </MemoryRouter>
      );
    };
  }

  beforeEach(() => {
    socketHandlers.clear();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('prepends new conversation to the cache', () => {
    qc.setQueryData([...conversationsKey], [mockDmConversation]);

    renderHook(() => useConversations(), { wrapper: makeWrapper() });

    const newConv: Conversation = { ...mockGroupConversation, id: 'conv-new' };

    act(() => {
      const handlers = socketHandlers.get('conversation:new') ?? [];
      handlers.forEach((h) => h({ conversation: newConv }));
    });

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data?.[0]?.id).toBe('conv-new');
    expect(data?.[1]?.id).toBe(mockDmConversation.id);
  });

  it('does not duplicate an already-present conversation', () => {
    qc.setQueryData([...conversationsKey], [mockDmConversation]);

    renderHook(() => useConversations(), { wrapper: makeWrapper() });

    act(() => {
      const handlers = socketHandlers.get('conversation:new') ?? [];
      handlers.forEach((h) => h({ conversation: mockDmConversation }));
    });

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data).toHaveLength(1);
  });

  it('seeds the list when cache is empty', () => {
    renderHook(() => useConversations(), { wrapper: makeWrapper() });

    const newConv: Conversation = mockDmConversation;
    act(() => {
      const handlers = socketHandlers.get('conversation:new') ?? [];
      handlers.forEach((h) => h({ conversation: newConv }));
    });

    const data = qc.getQueryData<Conversation[]>([...conversationsKey]);
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(mockDmConversation.id);
  });
});
