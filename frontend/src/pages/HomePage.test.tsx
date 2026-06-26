// src/pages/HomePage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import HomePage from './HomePage';
import { OverlayContext } from '@/layouts/overlayContext';

const openModal = vi.fn();
const overlayValue = {
  activeModal: null,
  openModal,
  closeModal: vi.fn(),
};

function renderHome(route = '/c') {
  return renderWithProviders(
    <OverlayContext.Provider value={overlayValue}>
      <HomePage />
    </OverlayContext.Provider>,
    { route },
  );
}

describe('HomePage', () => {
  it('renders the empty state when no conversation is selected', () => {
    renderHome('/c');
    expect(
      screen.getByText(/select a conversation or find friends/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find friends/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
  });

  it('opens find-friends modal from empty state', async () => {
    const user = userEvent.setup();
    renderHome('/c');
    await user.click(screen.getByRole('button', { name: /find friends/i }));
    expect(openModal).toHaveBeenCalledWith('find-friends');
  });

  it('opens create-group modal from empty state', async () => {
    const user = userEvent.setup();
    renderHome('/c');
    await user.click(screen.getByRole('button', { name: /create group/i }));
    expect(openModal).toHaveBeenCalledWith('create-group');
  });
});
