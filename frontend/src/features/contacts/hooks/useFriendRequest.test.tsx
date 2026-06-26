// src/features/contacts/hooks/useFriendRequest.test.tsx
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSendFriendRequest,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
} from './useFriendRequest';
import { server } from '@/mocks/server';

const API = 'http://localhost:4000/api';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useSendFriendRequest', () => {
  it('succeeds and resolves', async () => {
    const { result } = renderHook(() => useSendFriendRequest(), { wrapper });
    result.current.mutate('dddddddd-dddd-dddd-dddd-dddddddddddd');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('enters error state on failure', async () => {
    server.use(
      http.post(`${API}/contacts/requests`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'fail' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useSendFriendRequest(), { wrapper });
    result.current.mutate('dddddddd-dddd-dddd-dddd-dddddddddddd');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useAcceptFriendRequest', () => {
  it('succeeds', async () => {
    const { result } = renderHook(() => useAcceptFriendRequest(), { wrapper });
    result.current.mutate('cccccccc-cccc-cccc-cccc-cccccccccccc');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useDeclineFriendRequest', () => {
  it('succeeds', async () => {
    const { result } = renderHook(() => useDeclineFriendRequest(), { wrapper });
    result.current.mutate('cccccccc-cccc-cccc-cccc-cccccccccccc');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
