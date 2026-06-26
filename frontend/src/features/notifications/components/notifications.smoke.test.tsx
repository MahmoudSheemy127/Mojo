// Minimal smoke tests for notification-list components — covers branches in
// NotificationList (loading/error/ready-empty/ready-items),
// FriendRequestItem (unread flag), GenericNotificationItem (unread flag),
// GroupInviteItem (unread flag), and JoinRequestItem (unread flag).
// Stage 6 will wire these to the real notifications data layer.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Notification } from '@/types/entities';
import { NotificationList } from './NotificationList';
import { FriendRequestItem } from './FriendRequestItem';
import { GenericNotificationItem } from './GenericNotificationItem';
import { GroupInviteItem } from './GroupInviteItem';
import { JoinRequestItem } from './JoinRequestItem';

const actor = {
  id: 'u1',
  username: 'aria',
  displayName: 'Aria Chen',
};

const base: Notification = {
  id: 'n1',
  kind: 'generic',
  actor,
  text: 'Aria accepted your request',
  createdAt: '2m',
};

describe('NotificationList', () => {
  it('renders loading skeletons when state=loading', () => {
    const { container } = render(<NotificationList state="loading" />);
    // Three skeleton rows rendered as sibling divs inside the loading section
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error message and retry button when state=error', () => {
    render(<NotificationList state="error" />);
    expect(screen.getByText(/load notifications/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('renders empty state when state=ready and items=[]', () => {
    render(<NotificationList state="ready" items={[]} />);
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
  });

  it('renders all four notification kinds', () => {
    const items: Notification[] = [
      { ...base, id: 'n1', kind: 'friend-request', text: 'Esme wants to add you' },
      { ...base, id: 'n2', kind: 'group-invite', text: 'Aria invited you to Design Guild', groupName: 'Design Guild' },
      { ...base, id: 'n3', kind: 'join-request', text: 'Ben wants to join Weekend Crew', groupName: 'Weekend Crew' },
      { ...base, id: 'n4', kind: 'generic', text: 'Cleo accepted your request' },
    ];
    render(<NotificationList state="ready" items={items} />);
    expect(screen.getByText('Esme wants to add you')).toBeInTheDocument();
    expect(screen.getByText('Aria invited you to Design Guild')).toBeInTheDocument();
    expect(screen.getByText('Ben wants to join Weekend Crew')).toBeInTheDocument();
    expect(screen.getByText('Cleo accepted your request')).toBeInTheDocument();
  });
});

describe('FriendRequestItem', () => {
  it('renders without highlighted background when unread is false', () => {
    const { container } = render(
      <FriendRequestItem notification={{ ...base, kind: 'friend-request', unread: false }} />,
    );
    expect(container.querySelector('li')!.className).not.toContain('bg-bg-hover');
  });

  it('renders with highlighted background when unread is true', () => {
    const { container } = render(
      <FriendRequestItem notification={{ ...base, kind: 'friend-request', unread: true }} />,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });

  it('shows Accept and Decline buttons', () => {
    render(<FriendRequestItem notification={{ ...base, kind: 'friend-request' }} />);
    expect(screen.getByRole('button', { name: /accept/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument();
  });
});

describe('GenericNotificationItem', () => {
  it('renders without highlighted background when unread is false', () => {
    const { container } = render(
      <GenericNotificationItem notification={{ ...base, unread: false }} />,
    );
    expect(container.querySelector('li')!.className).not.toContain('bg-bg-hover');
  });

  it('renders with highlighted background when unread is true', () => {
    const { container } = render(
      <GenericNotificationItem notification={{ ...base, unread: true }} />,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });
});

describe('GroupInviteItem', () => {
  const groupNotif: Notification = {
    ...base,
    kind: 'group-invite',
    groupName: 'Design Guild',
    text: 'Aria invited you to Design Guild',
  };

  it('renders without highlighted background when unread is false', () => {
    const { container } = render(
      <GroupInviteItem notification={{ ...groupNotif, unread: false }} />,
    );
    expect(container.querySelector('li')!.className).not.toContain('bg-bg-hover');
  });

  it('renders with highlighted background when unread is true', () => {
    const { container } = render(
      <GroupInviteItem notification={{ ...groupNotif, unread: true }} />,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });
});

describe('JoinRequestItem', () => {
  const joinNotif: Notification = {
    ...base,
    kind: 'join-request',
    groupName: 'Weekend Crew',
    text: 'Ben wants to join Weekend Crew',
  };

  it('renders without highlighted background when unread is false', () => {
    const { container } = render(
      <JoinRequestItem notification={{ ...joinNotif, unread: false }} />,
    );
    expect(container.querySelector('li')!.className).not.toContain('bg-bg-hover');
  });

  it('renders with highlighted background when unread is true', () => {
    const { container } = render(
      <JoinRequestItem notification={{ ...joinNotif, unread: true }} />,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });
});
