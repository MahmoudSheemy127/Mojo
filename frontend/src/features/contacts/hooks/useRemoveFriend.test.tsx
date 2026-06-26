// src/features/contacts/hooks/useRemoveFriend.test.tsx
import { describe, it, expect } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRemoveFriend } from './useRemoveFriend';
import { friendsKey } from './useContacts';
import { server } from '@/mocks/server';
import { mockFriends } from '@/mocks/handlers';
import type { PublicUser } from '@/types/api';

const API = 'http://localhost:4000/api';

function setup() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData<PublicUser[]>(friendsKey, [...mockFriends]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { qc, wrapper };
}

describe('useRemoveFriend', () => {
  it('optimistically removes friend and confirms on success', async () => {
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFriend(), { wrapper });

    result.current.mutate(mockFriends[0]!.id);

    // Optimistic removal
    await waitFor(() =>
      expect(qc.getQueryData<PublicUser[]>(friendsKey)).toHaveLength(1),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back on error', async () => {
    server.use(
      http.delete(`${API}/contacts/:userId`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'fail' } }, { status: 500 }),
      ),
    );
    const { qc, wrapper } = setup();
    const { result } = renderHook(() => useRemoveFriend(), { wrapper });

    result.current.mutate(mockFriends[0]!.id);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(qc.getQueryData<PublicUser[]>(friendsKey)).toHaveLength(mockFriends.length);
  });
});
