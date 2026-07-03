// src/features/notifications/components/notifications.smoke.test.tsx
// Component tests for the notification dropdown: NotificationList container
// states (loading / error / empty / items) and the four item components
// (unread emphasis, action dispatch, mention navigation).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import type { Notification } from '@/types/entities';
import { NotificationList } from './NotificationList';
import { FriendRequestItem } from './FriendRequestItem';
import { GenericNotificationItem } from './GenericNotificationItem';
import { GroupInviteItem } from './GroupInviteItem';
import { JoinRequestItem } from './JoinRequestItem';
import { notificationsKey } from '../hooks/useNotifications';

const API = 'http://localhost:4000/api';

// Notification hooks subscribe to the socket; mock it so no real connection opens.
vi.mock('@/hooks/useSocket', () => ({
  socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), connected: false },
}));

function renderWithClient(ui: ReactNode, route = '/') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { qc, ...result };
}

const actor = { id: 'u1', username: 'aria', displayName: 'Aria Chen' };
const base: Notification = {
  id: 'n1',
  kind: 'generic',
  actor,
  text: 'Aria accepted your request',
  createdAt: '2m',
};

describe('NotificationList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeletons while loading', () => {
    const { container } = renderWithClient(<NotificationList />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders the feed items once loaded', async () => {
    renderWithClient(<NotificationList />);
    expect(
      await screen.findByText('Aria Chen sent you a friend request.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ben Okafor invited you to a group.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Aria Chen mentioned you')).toBeInTheDocument();
  });

  it('renders the empty state when the feed is empty', async () => {
    server.use(
      http.get(`${API}/notifications`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );
    renderWithClient(<NotificationList />);
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });

  it('renders the error state with retry on failure', async () => {
    server.use(
      http.get(`${API}/notifications`, () =>
        HttpResponse.json(
          { error: { code: 'E', message: 'x' } },
          { status: 500 },
        ),
      ),
    );
    renderWithClient(<NotificationList />);
    expect(await screen.findByText(/couldn’t load notifications/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});

describe('FriendRequestItem', () => {
  const friendNotif: Notification = {
    ...base,
    kind: 'friend-request',
    text: 'Esme wants to add you',
    requestId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  };

  it('emphasizes unread rows', () => {
    const { container } = renderWithClient(
      <ul>
        <FriendRequestItem notification={{ ...friendNotif, unread: true }} />
      </ul>,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });

  it('does not emphasize read rows', () => {
    const { container } = renderWithClient(
      <ul>
        <FriendRequestItem notification={{ ...friendNotif, unread: false }} />
      </ul>,
    );
    expect(container.querySelector('li')!.className).not.toContain('bg-bg-hover');
  });

  it('dispatches accept and removes the row', async () => {
    const { qc } = renderWithClient(
      <ul>
        <FriendRequestItem notification={friendNotif} />
      </ul>,
    );
    qc.setQueryData<Notification[]>(notificationsKey, [friendNotif]);
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() =>
      expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0),
    );
  });
});

describe('GroupInviteItem', () => {
  const groupNotif: Notification = {
    ...base,
    kind: 'group-invite',
    groupName: 'Design Guild',
    text: 'Aria invited you to Design Guild',
    groupId: 'group-2222-2222-2222-222222222222',
    inviteId: 'inv-2222-2222-2222-222222222222',
  };

  it('emphasizes unread rows', () => {
    const { container } = renderWithClient(
      <ul>
        <GroupInviteItem notification={{ ...groupNotif, unread: true }} />
      </ul>,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });

  it('dispatches accept and removes the row', async () => {
    const { qc } = renderWithClient(
      <ul>
        <GroupInviteItem notification={groupNotif} />
      </ul>,
    );
    qc.setQueryData<Notification[]>(notificationsKey, [groupNotif]);
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() =>
      expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0),
    );
  });
});

describe('JoinRequestItem', () => {
  const joinNotif: Notification = {
    ...base,
    kind: 'join-request',
    groupName: 'Weekend Crew',
    text: 'Ben wants to join Weekend Crew',
    groupId: 'group-2222-2222-2222-222222222222',
    requestId: 'req-9999-9999-9999-999999999999',
  };

  it('emphasizes unread rows', () => {
    const { container } = renderWithClient(
      <ul>
        <JoinRequestItem notification={{ ...joinNotif, unread: true }} />
      </ul>,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });

  it('dispatches decline and removes the row', async () => {
    const { qc } = renderWithClient(
      <ul>
        <JoinRequestItem notification={joinNotif} />
      </ul>,
    );
    qc.setQueryData<Notification[]>(notificationsKey, [joinNotif]);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    await waitFor(() =>
      expect(qc.getQueryData<Notification[]>(notificationsKey)).toHaveLength(0),
    );
  });
});

describe('GenericNotificationItem', () => {
  it('emphasizes unread rows', () => {
    const { container } = renderWithClient(
      <ul>
        <GenericNotificationItem notification={{ ...base, unread: true }} />
      </ul>,
    );
    expect(container.querySelector('li')!.className).toContain('bg-bg-hover');
  });

  it('navigates to the conversation when a mention is clicked', async () => {
    function LocationDisplay() {
      const loc = useLocation();
      return <div data-testid="loc">{loc.pathname}</div>;
    }
    const mention: Notification = {
      ...base,
      text: 'Aria mentioned you',
      conversationId: 'conv-3333',
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              path="/"
              element={
                <ul>
                  <GenericNotificationItem notification={mention} />
                </ul>
              }
            />
            <Route path="/c/:id" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /mentioned you/i }));
    expect(await screen.findByTestId('loc')).toHaveTextContent('/c/conv-3333');
  });

  it('is not interactive without a conversation id', () => {
    renderWithClient(
      <ul>
        <GenericNotificationItem notification={base} />
      </ul>,
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
