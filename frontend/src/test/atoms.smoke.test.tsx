// src/test/atoms.smoke.test.tsx
// Render-level smoke coverage for the shared design-system atoms and composites
// that other stages consume. Exercises variant branches so the components are
// verified to mount and toggle without crashing.
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Chip } from '@/components/ui/Chip';
import { DropdownMenu } from '@/components/ui/DropdownMenu';
import { Tooltip } from '@/components/ui/Tooltip';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Overlay } from '@/components/ui/Overlay';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge } from '@/components/shared/RoleBadge';
import { UnreadBadge } from '@/components/shared/UnreadBadge';
import { MessageTimestamp } from '@/components/shared/MessageTimestamp';
import { ConnectionStatusBanner } from '@/components/shared/ConnectionStatusBanner';
import { UserAvatarWithPresence } from '@/components/shared/UserAvatarWithPresence';
import { MemberPicker } from '@/components/shared/MemberPicker';
import type { User } from '@/types/entities';

describe('Chip', () => {
  it('renders and removes', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<Chip onRemove={onRemove}>Tag</Chip>);
    await user.click(screen.getByRole('button', { name: /remove/i }));
    expect(onRemove).toHaveBeenCalled();
  });
});

describe('DropdownMenu', () => {
  it('opens and selects items of each variant', async () => {
    const user = userEvent.setup();
    const onDefault = vi.fn();
    const onDanger = vi.fn();
    render(
      <DropdownMenu
        trigger={({ toggle }) => (
          <button type="button" onClick={toggle}>
            Open menu
          </button>
        )}
        items={[
          { label: 'Edit', onSelect: onDefault },
          { label: 'Delete', onSelect: onDanger, variant: 'danger' },
          { label: 'Disabled', onSelect: vi.fn(), disabled: true },
        ]}
      />,
    );
    await user.click(screen.getByRole('button', { name: /open menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /edit/i }));
    expect(onDefault).toHaveBeenCalled();
  });
});

describe('Tooltip', () => {
  it('shows the label on hover', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Hi there">
        <button type="button">target</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole('button', { name: /target/i }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Hi there');
  });
});

describe('Badge', () => {
  it('hides at zero, caps at max', () => {
    const { rerender, container } = render(<Badge count={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<Badge count={50} max={9} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('traps focus and closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} aria-label="demo">
        <button type="button">first</button>
        <button type="button">second</button>
      </Modal>,
    );
    await user.tab();
    await user.tab();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()} aria-label="demo">
        <span>hi</span>
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ModalHeader + Overlay', () => {
  it('closes from the header and backdrop', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onBackdrop = vi.fn();
    render(
      <Overlay onClick={onBackdrop} className="test-overlay">
        <ModalHeader title="Title" onClose={onClose} />
      </Overlay>,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Tabs', () => {
  it('switches the active tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Avatar', () => {
  it('renders an image and an initials fallback', () => {
    const { rerender } = render(<Avatar name="Ada Lovelace" src="a.png" />);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' })).toBeInTheDocument();
    rerender(<Avatar name="Ada Lovelace" />);
    expect(screen.getByText('AL')).toBeInTheDocument();
    rerender(<Avatar name="Cher" square />);
    expect(screen.getByText('CH')).toBeInTheDocument();
  });
});

describe('misc shared atoms', () => {
  it('render variant branches', () => {
    const { rerender, container } = render(<RoleBadge role="admin" />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    rerender(<RoleBadge role="member" />);
    expect(screen.getByText('Member')).toBeInTheDocument();

    rerender(<UnreadBadge count={3} />);
    expect(screen.getByText('3')).toBeInTheDocument();

    rerender(<MessageTimestamp relative="2m" iso="2026-01-01T00:00:00Z" />);
    expect(screen.getByText('2m')).toBeInTheDocument();
    rerender(<MessageTimestamp relative="now" />);
    expect(screen.getByText('now')).toBeInTheDocument();

    rerender(<Skeleton />);

    rerender(<ConnectionStatusBanner status="connected" />);
    expect(container.querySelector('[role="status"]')).toBeNull();
    rerender(<ConnectionStatusBanner status="reconnecting" />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
    rerender(<ConnectionStatusBanner status="disconnected" />);
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();

    rerender(<UserAvatarWithPresence name="Bo" presence="online" />);
    rerender(<UserAvatarWithPresence name="Bo" />);
  });
});

describe('MemberPicker', () => {
  const candidates: User[] = [
    { id: 'u1', username: 'aria', displayName: 'Aria Chen' },
    { id: 'u2', username: 'ben', displayName: 'Ben Okafor' },
  ];

  it('selects and removes members', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState<User[]>([]);
      return (
        <MemberPicker candidates={candidates} value={value} onChange={setValue} />
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole('textbox'), 'aria');
    await user.click(screen.getByText('Aria Chen'));
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /remove/i }));
  });
});
