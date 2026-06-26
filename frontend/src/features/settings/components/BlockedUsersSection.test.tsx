// src/features/settings/components/BlockedUsersSection.test.tsx
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockedUsersSection } from './BlockedUsersSection';
import { renderWithProviders } from '@/test/render';
import { server } from '@/mocks/server';

const API = 'http://localhost:4000/api';

describe('BlockedUsersSection', () => {
  it('shows a loading state then the blocked list', async () => {
    renderWithProviders(<BlockedUsersSection />);
    expect(screen.getByText(/loading…/i)).toBeInTheDocument();
    expect(await screen.findByText('Mallory')).toBeInTheDocument();
    expect(screen.getByText('@trent')).toBeInTheDocument();
  });

  it('shows the empty state when nobody is blocked', async () => {
    server.use(
      http.get(`${API}/contacts/blocked`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );
    renderWithProviders(<BlockedUsersSection />);
    expect(
      await screen.findByText(/haven't blocked anyone/i),
    ).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    server.use(
      http.get(`${API}/contacts/blocked`, () =>
        HttpResponse.json(
          { error: { code: 'X', message: 'boom' } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<BlockedUsersSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it('unblocks a user after confirming', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BlockedUsersSection />);
    await screen.findByText('Mallory');

    await user.click(screen.getAllByRole('button', { name: /^unblock$/i })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^unblock$/i }));

    await waitFor(() =>
      expect(screen.queryByText('Mallory')).not.toBeInTheDocument(),
    );
  });
});
