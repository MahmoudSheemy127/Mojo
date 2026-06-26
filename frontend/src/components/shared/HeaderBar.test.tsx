// src/components/shared/HeaderBar.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HeaderBar } from './HeaderBar';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from '@/mocks/handlers';
import { OverlayContext } from '@/layouts/overlayContext';

function renderHeader(openModal = vi.fn()) {
  return renderWithProviders(
    <OverlayContext.Provider
      value={{ activeModal: null, openModal, closeModal: vi.fn() }}
    >
      <HeaderBar />
    </OverlayContext.Provider>,
    { route: '/c' },
  );
}

describe('HeaderBar', () => {
  beforeEach(() => useAuthStore.getState().setUser(mockUser, 'tok'));

  it('renders the brand and the current user in the profile popover', async () => {
    const user = userEvent.setup();
    renderHeader();
    expect(screen.getByText('Mojo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /profile and status/i }));
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /online/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('opens the Find friends modal', async () => {
    const user = userEvent.setup();
    const openModal = vi.fn();
    renderHeader(openModal);
    await user.click(screen.getByRole('button', { name: /find friends/i }));
    expect(openModal).toHaveBeenCalledWith('find-friends');
  });

  it('updates presence when a status is chosen', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: /profile and status/i }));
    await user.click(screen.getByRole('option', { name: /do not disturb/i }));
    await waitFor(() =>
      expect(useAuthStore.getState().currentUser?.presence).toBe('dnd'),
    );
  });

  it('logs out from the profile popover', async () => {
    const user = userEvent.setup();
    renderHeader();
    await user.click(screen.getByRole('button', { name: /profile and status/i }));
    await user.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() =>
      expect(useAuthStore.getState().isAuthenticated).toBe(false),
    );
  });
});
