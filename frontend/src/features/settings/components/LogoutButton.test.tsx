// src/features/settings/components/LogoutButton.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutButton } from './LogoutButton';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from '@/mocks/handlers';

describe('LogoutButton', () => {
  beforeEach(() => useAuthStore.getState().setUser(mockUser, 'tok'));

  it('confirms before logging out, then clears the session', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogoutButton />, { route: '/settings' });

    await user.click(screen.getByRole('button', { name: /^log out$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^log out$/i }));

    await waitFor(() =>
      expect(useAuthStore.getState().isAuthenticated).toBe(false),
    );
  });

  it('stays signed in when cancelled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LogoutButton />, { route: '/settings' });
    await user.click(screen.getByRole('button', { name: /^log out$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /stay signed in/i }));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
