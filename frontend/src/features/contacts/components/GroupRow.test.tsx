// src/features/contacts/components/GroupRow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@testing-library/react';
import { GroupRow } from './GroupRow';
import type { ConversationSummary } from '@/types/entities';

const group: ConversationSummary = {
  id: 'g1',
  type: 'group',
  name: 'Design Guild',
};

describe('GroupRow', () => {
  it('renders the group name', () => {
    render(<GroupRow group={group} onOpen={vi.fn()} />);
    expect(screen.getByText('Design Guild')).toBeInTheDocument();
  });

  it('calls onOpen when the row is clicked', async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(<GroupRow group={group} onOpen={onOpen} />);
    await user.click(screen.getByText('Design Guild'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('shows Open and Leave group in menu when onLeave provided', async () => {
    const user = userEvent.setup();
    render(
      <GroupRow group={group} onOpen={vi.fn()} onLeave={vi.fn()} />,
    );
    await user.click(
      screen.getByRole('button', { name: /actions for design guild/i }),
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Leave group')).toBeInTheDocument();
  });

  it('shows only Open when onLeave is omitted', async () => {
    const user = userEvent.setup();
    render(<GroupRow group={group} onOpen={vi.fn()} />);
    await user.click(
      screen.getByRole('button', { name: /actions for design guild/i }),
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Leave group')).not.toBeInTheDocument();
  });

  it('calls onLeave when Leave group is selected', async () => {
    const onLeave = vi.fn();
    const user = userEvent.setup();
    render(<GroupRow group={group} onOpen={vi.fn()} onLeave={onLeave} />);
    await user.click(
      screen.getByRole('button', { name: /actions for design guild/i }),
    );
    await user.click(screen.getByText('Leave group'));
    expect(onLeave).toHaveBeenCalledOnce();
  });
});
