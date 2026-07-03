// src/features/groups/hooks/useInviteMembers.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { useInviteMembers } from './useInviteMembers';
import { server } from '@/mocks/server';
import { mockFriends, GROUP_ID } from '@/mocks/handlers';

const API = 'http://localhost:4000/api';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useInviteMembers', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  });

  it('invite.mutate posts to /groups/:groupId/members and invalidates members key', async () => {
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useInviteMembers(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.invite.mutate([mockFriends[0]!.id]);
    });

    await waitFor(() => expect(result.current.invite.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['groups', GROUP_ID, 'members'] }),
    );
  });

  it('invite enters error state on API failure', async () => {
    server.use(
      http.post(`${API}/groups/${GROUP_ID}/members`, () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'fail' } }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useInviteMembers(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.invite.mutate([mockFriends[0]!.id]);
    });

    await waitFor(() => expect(result.current.invite.isError).toBe(true));
  });

  it('generateLink.mutate posts to /groups/:groupId/invite-link and returns url', async () => {
    const { result } = renderHook(() => useInviteMembers(GROUP_ID), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      result.current.generateLink.mutate();
    });

    await waitFor(() => expect(result.current.generateLink.isSuccess).toBe(true));
    expect(result.current.generateLink.data?.url).toContain(GROUP_ID);
  });
});
