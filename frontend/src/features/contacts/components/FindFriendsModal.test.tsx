// src/features/contacts/components/FindFriendsModal.test.tsx
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { FindFriendsModal } from './FindFriendsModal';
import { server } from '@/mocks/server';
import { mockFriends, mockSearchStranger } from '@/mocks/handlers';

const API = 'http://localhost:4000/api';

function renderModal(open = true) {
  const onClose = () => {};
  return renderWithProviders(<FindFriendsModal open={open} onClose={onClose} />);
}

describe('FindFriendsModal', () => {
  it('renders the idle state with search prompt', () => {
    renderModal();
    expect(screen.getByText(/start typing to find people/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderModal(false);
    expect(screen.queryByText(/find friends/i)).not.toBeInTheDocument();
  });

  it('shows search results after typing', async () => {
    const user = userEvent.setup({ delay: null });
    renderModal();
    const input = screen.getByRole('textbox', { name: /search users/i });
    await user.type(input, 'aria');
    await waitFor(() =>
      expect(screen.getByText(mockFriends[0]!.displayName)).toBeInTheDocument(),
    );
  });

  it('shows the Add friend button for a non-friend result', async () => {
    const user = userEvent.setup({ delay: null });
    renderModal();
    const input = screen.getByRole('textbox', { name: /search users/i });
    await user.type(input, 'charlie');
    await waitFor(() =>
      expect(screen.getByText(mockSearchStranger.displayName)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /add friend/i })).toBeInTheDocument();
  });

  it('shows no results message when API returns empty', async () => {
    server.use(
      http.get(`${API}/users/search`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );
    const user = userEvent.setup({ delay: null });
    renderModal();
    const input = screen.getByRole('textbox', { name: /search users/i });
    await user.type(input, 'zzz');
    await waitFor(() =>
      expect(screen.getByText(/no users found/i)).toBeInTheDocument(),
    );
  });

  it('shows error state with retry on API failure', async () => {
    server.use(
      http.get(`${API}/users/search`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'fail' } }, { status: 500 }),
      ),
    );
    const user = userEvent.setup({ delay: null });
    renderModal();
    const input = screen.getByRole('textbox', { name: /search users/i });
    await user.type(input, 'fail');
    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('sends a friend request when Add friend is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    renderModal();
    const input = screen.getByRole('textbox', { name: /search users/i });
    await user.type(input, 'charlie');
    const addBtn = await screen.findByRole('button', { name: /add friend/i });
    await user.click(addBtn);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /requested/i })).toBeDisabled(),
    );
  });
});
