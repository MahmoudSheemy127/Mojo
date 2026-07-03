// src/features/groups/hooks/useLeaveGroup.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useLeaveGroup } from './useLeaveGroup';
import { useAuthStore } from '@/store/authStore';
import { server } from '@/mocks/server';
import { GROUP_ID } from '@/mocks/handlers';

const API = 'http://localhost:4000/api';
const SELF_ID = '11111111-1111-1111-1111-111111111111';

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

describe('useLeaveGroup', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockNavigate.mockClear();
    useAuthStore.setState({
      currentUser: {
        id: SELF_ID,
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

  it('calls DELETE /groups/:groupId/members/:selfId and navigates home', async () => {
    let capturedUrl = '';
    server.use(
      http.delete(`${API}/groups/:groupId/members/:userId`, ({ params, request }) => {
        capturedUrl = request.url;
        expect(params['userId']).toBe(SELF_ID);
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useLeaveGroup(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(capturedUrl).toContain(SELF_ID);
    expect(mockNavigate).toHaveBeenCalledWith('/c');
  });

  it('enters error state on API failure', async () => {
    server.use(
      http.delete(`${API}/groups/:groupId/members/:userId`, () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'fail' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useLeaveGroup(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
