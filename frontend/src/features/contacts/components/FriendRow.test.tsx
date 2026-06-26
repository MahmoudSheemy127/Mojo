// src/features/contacts/components/FriendRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { FriendRow } from './FriendRow';
import type { User } from '@/types/entities';

const friend: User = {
  id: 'u1',
  username: 'aria',
  displayName: 'Aria Chen',
  presence: 'online',
};

describe('FriendRow', () => {
  it('renders display name and presence label', () => {
    render(<FriendRow friend={friend} onMessage={vi.fn()} />);
    expect(screen.getByText('Aria Chen')).toBeInTheDocument();
    // Presence label appears in the status line (may also appear in a tooltip/title)
    expect(screen.getAllByText('Online').length).toBeGreaterThan(0);
  });

  it('shows @username when presence is undefined', () => {
    const noPresence = { ...friend, presence: undefined };
    render(<FriendRow friend={noPresence} onMessage={vi.fn()} />);
    expect(screen.getByText('@aria')).toBeInTheDocument();
  });

  it('calls onMessage when the row body is clicked', async () => {
    const onMessage = vi.fn();
    const user = userEvent.setup();
    render(<FriendRow friend={friend} onMessage={onMessage} />);
    await user.click(screen.getByText('Aria Chen'));
    expect(onMessage).toHaveBeenCalledOnce();
  });

  it('shows overflow menu with Message, Block and Remove items when all callbacks provided', async () => {
    const user = userEvent.setup();
    render(
      <FriendRow
        friend={friend}
        onMessage={vi.fn()}
        onBlock={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: /actions for aria chen/i }),
    );
    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.getByText('Block')).toBeInTheDocument();
    expect(screen.getByText('Remove friend')).toBeInTheDocument();
  });

  it('shows only Message item when onBlock and onRemove are omitted', async () => {
    const user = userEvent.setup();
    render(<FriendRow friend={friend} onMessage={vi.fn()} />);
    await user.click(
      screen.getByRole('button', { name: /actions for aria chen/i }),
    );
    expect(screen.getByText('Message')).toBeInTheDocument();
    expect(screen.queryByText('Block')).not.toBeInTheDocument();
    expect(screen.queryByText('Remove friend')).not.toBeInTheDocument();
  });

  it('calls onBlock when Block is selected', async () => {
    const onBlock = vi.fn();
    const user = userEvent.setup();
    render(
      <FriendRow friend={friend} onMessage={vi.fn()} onBlock={onBlock} />,
    );
    await user.click(
      screen.getByRole('button', { name: /actions for aria chen/i }),
    );
    await user.click(screen.getByText('Block'));
    expect(onBlock).toHaveBeenCalledOnce();
  });

  it('calls onRemove when Remove friend is selected', async () => {
    const onRemove = vi.fn();
    const user = userEvent.setup();
    render(
      <FriendRow friend={friend} onMessage={vi.fn()} onRemove={onRemove} />,
    );
    await user.click(
      screen.getByRole('button', { name: /actions for aria chen/i }),
    );
    await user.click(screen.getByText('Remove friend'));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
