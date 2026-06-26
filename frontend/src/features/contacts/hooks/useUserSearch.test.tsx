// src/features/contacts/hooks/useUserSearch.test.tsx
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUserSearch } from './useUserSearch';
import { server } from '@/mocks/server';

const API = 'http://localhost:4000/api';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useUserSearch', () => {
  it('is disabled when query is empty', () => {
    const { result } = renderHook(() => useUserSearch(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches results for a non-empty query', async () => {
    const { result } = renderHook(() => useUserSearch('aria'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeDefined();
  });

  it('returns empty array when no results', async () => {
    server.use(
      http.get(`${API}/users/search`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );
    const { result } = renderHook(() => useUserSearch('xyz'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });
});
