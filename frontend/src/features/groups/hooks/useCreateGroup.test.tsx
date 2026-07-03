// src/features/groups/hooks/useCreateGroup.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useCreateGroup } from './useCreateGroup';
import { server } from '@/mocks/server';
import { mockGroup } from '@/mocks/handlers';

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

describe('useCreateGroup', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockNavigate.mockClear();
  });

  it('creates a group, navigates to its chat, and invalidates conversations', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateGroup(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ name: 'Weekend Crew', memberIds: [] });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockNavigate).toHaveBeenCalledWith(`/c/${mockGroup.id}`);
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: expect.arrayContaining(['conversations']) }),
    );
  });

  it('enters error state on API failure', async () => {
    server.use(
      http.post(`${API}/groups`, () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'fail' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useCreateGroup(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ name: 'Broken group' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
