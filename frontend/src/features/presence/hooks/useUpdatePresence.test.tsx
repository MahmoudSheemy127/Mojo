// src/features/presence/hooks/useUpdatePresence.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUpdatePresence } from './useUpdatePresence';
import { meKey } from '@/features/settings/hooks/useMe';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import { mockUser } from '@/mocks/handlers';
import { server } from '@/mocks/server';
import type { SelfUser } from '@/types/api';

const API = 'http://localhost:4000/api';

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryData<SelfUser>(meKey, { ...mockUser, presence: 'online' });
  useAuthStore.getState().setUser({ ...mockUser, presence: 'online' }, 'tok');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

describe('useUpdatePresence', () => {
  beforeEach(() => useToastStore.getState().clear());

  it('optimistically updates presence and persists on success', async () => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdatePresence(), { wrapper });

    result.current.mutate('dnd');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<SelfUser>(meKey)?.presence).toBe('dnd');
    expect(useAuthStore.getState().currentUser?.presence).toBe('dnd');
  });

  it('rolls back and toasts on error', async () => {
    server.use(
      http.patch(`${API}/users/me/presence`, () =>
        HttpResponse.json(
          { error: { code: 'X', message: 'nope' } },
          { status: 500 },
        ),
      ),
    );
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useUpdatePresence(), { wrapper });

    result.current.mutate('dnd');

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<SelfUser>(meKey)?.presence).toBe('online');
    expect(useAuthStore.getState().currentUser?.presence).toBe('online');
    expect(
      useToastStore.getState().toasts.some((t) => t.variant === 'error'),
    ).toBe(true);
  });
});
