// src/features/contacts/hooks/useContacts.test.tsx
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContacts } from './useContacts';
import { server } from '@/mocks/server';
import { mockFriends } from '@/mocks/handlers';

const API = 'http://localhost:4000/api';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useContacts', () => {
  it('returns the friends list on success', async () => {
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(mockFriends.length);
    expect(result.current.data?.[0]?.displayName).toBe('Aria Chen');
  });

  it('enters error state on API failure', async () => {
    server.use(
      http.get(`${API}/contacts`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'oops' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useContacts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
