// src/test/render.tsx
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
}

/** Renders a UI tree wrapped in a fresh QueryClient + MemoryRouter. */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { route = '/login', ...rest } = options;
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}
