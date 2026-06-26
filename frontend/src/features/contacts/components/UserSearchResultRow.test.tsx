// src/features/contacts/components/UserSearchResultRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { UserSearchResultRow } from './UserSearchResultRow';
import type { PublicUser } from '@/types/api';

const mockUser: PublicUser = {
  id: 'u1',
  username: 'aria',
  displayName: 'Aria Chen',
  avatarUrl: null,
  bio: null,
  presence: 'online',
};

describe('UserSearchResultRow', () => {
  it('shows Add friend button for "none" relationship', () => {
    renderWithProviders(
      <ul><UserSearchResultRow user={mockUser} relationship="none" /></ul>,
    );
    expect(screen.getByRole('button', { name: /add friend/i })).toBeInTheDocument();
  });

  it('shows disabled Requested button for "request_sent"', () => {
    renderWithProviders(
      <ul><UserSearchResultRow user={mockUser} relationship="request_sent" /></ul>,
    );
    expect(screen.getByRole('button', { name: /requested/i })).toBeDisabled();
  });

  it('shows Accept button for "request_received"', () => {
    renderWithProviders(
      <ul><UserSearchResultRow user={mockUser} relationship="request_received" /></ul>,
    );
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
  });

  it('shows Friends tag for "friends"', () => {
    renderWithProviders(
      <ul><UserSearchResultRow user={mockUser} relationship="friends" /></ul>,
    );
    expect(screen.getByText(/friends/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows Unavailable for "blocked"', () => {
    renderWithProviders(
      <ul><UserSearchResultRow user={mockUser} relationship="blocked" /></ul>,
    );
    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it('calls onAdd when Add friend is clicked', async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ul>
        <UserSearchResultRow user={mockUser} relationship="none" onAdd={onAdd} />
      </ul>,
    );
    await user.click(screen.getByRole('button', { name: /add friend/i }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('shows user display name and username', () => {
    renderWithProviders(
      <ul><UserSearchResultRow user={mockUser} relationship="none" /></ul>,
    );
    expect(screen.getByText('Aria Chen')).toBeInTheDocument();
    expect(screen.getByText('@aria')).toBeInTheDocument();
  });
});
