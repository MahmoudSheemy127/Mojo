// src/pages/SettingsPage.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from '@/mocks/handlers';

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/c" element={<div>Home stub</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => useAuthStore.getState().setUser(mockUser, 'tok'));

  it('shows the Profile section by default', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
  });

  it('switches sections via the nav', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /security/i }));
    expect(
      screen.getByRole('button', { name: /send password reset email/i }),
    ).toBeInTheDocument();
  });

  it('closes back to the homepage', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /close settings/i }));
    expect(screen.getByText('Home stub')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Home stub')).toBeInTheDocument();
  });
});
