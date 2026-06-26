// src/features/presence/components/PresenceSelector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PresenceSelector } from './PresenceSelector';

describe('PresenceSelector', () => {
  it('renders all four statuses and marks the active one', () => {
    render(<PresenceSelector value="dnd" />);
    expect(screen.getByRole('option', { name: /online/i })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    const dnd = screen.getByRole('option', { name: /do not disturb/i });
    expect(dnd).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /invisible/i })).toBeInTheDocument();
  });

  it('calls onSelect with the chosen status', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PresenceSelector value="online" onSelect={onSelect} />);
    await user.click(screen.getByRole('option', { name: /do not disturb/i }));
    expect(onSelect).toHaveBeenCalledWith('dnd');
  });

  it('shows a pending spinner on the status being set', () => {
    render(<PresenceSelector value="online" pendingValue="idle" />);
    expect(screen.getByRole('option', { name: /away/i })).toBeDisabled();
    expect(screen.getByLabelText(/updating status/i)).toBeInTheDocument();
  });
});
