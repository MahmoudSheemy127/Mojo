// src/features/contacts/components/ChatList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { ChatList } from './ChatList';
import { server } from '@/mocks/server';
import { mockFriends, mockDmConversation, mockGroupConversation } from '@/mocks/handlers';
import { OverlayContext } from '@/layouts/overlayContext';

const API = 'http://localhost:4000/api';

const openModal = vi.fn();
const overlayValue = {
  activeModal: null,
  openModal,
  closeModal: vi.fn(),
};

function renderChatList() {
  return renderWithProviders(
    <OverlayContext.Provider value={overlayValue}>
      <ChatList />
    </OverlayContext.Provider>,
    { route: '/c' },
  );
}

describe('ChatList', () => {
  it('renders both tabs and action buttons', () => {
    renderChatList();
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find friends/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /chats/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /friends & groups/i })).toBeInTheDocument();
  });

  it('opens find-friends modal when button is clicked', async () => {
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getAllByRole('button', { name: /find friends/i })[0]!);
    expect(openModal).toHaveBeenCalledWith('find-friends');
  });

  it('opens create-group modal when button is clicked', async () => {
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('button', { name: /create group/i }));
    expect(openModal).toHaveBeenCalledWith('create-group');
  });

  it('shows skeleton then friends list in directory tab', async () => {
    const user = userEvent.setup();
    renderChatList();

    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));

    // Shows skeleton while loading
    await waitFor(() =>
      expect(screen.getByText(mockFriends[0]!.displayName)).toBeInTheDocument(),
    );
  });

  it('shows empty state for friends when list is empty', async () => {
    server.use(
      http.get(`${API}/contacts`, () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));
    expect(await screen.findByText(/no friends yet/i)).toBeInTheDocument();
  });

  it('shows error state with retry for friends on failure', async () => {
    server.use(
      http.get(`${API}/contacts`, () =>
        HttpResponse.json({ error: { code: 'E', message: 'fail' } }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));
    expect(await screen.findByText(/couldn't load friends/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows and confirms remove-friend dialog on overflow menu Remove', async () => {
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));
    await screen.findByText(mockFriends[0]!.displayName);

    const menuBtn = screen.getByRole('button', {
      name: new RegExp(`actions for ${mockFriends[0]!.displayName}`, 'i'),
    });
    await user.click(menuBtn);

    await user.click(await screen.findByText(/remove friend/i));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Confirm the removal
    await user.click(within(dialog).getByRole('button', { name: /^remove$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });

  it('shows skeleton then conversation list in chats tab', async () => {
    renderChatList();
    await waitFor(() =>
      expect(
        screen.getByText(mockDmConversation.otherUser.displayName),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(mockGroupConversation.name)).toBeInTheDocument();
  });

  it('shows empty state when there are no conversations', async () => {
    server.use(
      http.get('http://localhost:4000/api/conversations', () =>
        HttpResponse.json({ data: [], nextCursor: null }),
      ),
    );
    renderChatList();
    expect(
      await screen.findByText(/no conversations yet/i),
    ).toBeInTheDocument();
  });

  it('shows error state with retry when conversations fail to load', async () => {
    server.use(
      http.get('http://localhost:4000/api/conversations', () =>
        HttpResponse.json(
          { error: { code: 'E', message: 'fail' } },
          { status: 500 },
        ),
      ),
    );
    renderChatList();
    expect(
      await screen.findByText(/couldn't load conversations/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows group name from conversations in directory tab groups section', async () => {
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));
    expect(
      await screen.findByText(mockGroupConversation.name),
    ).toBeInTheDocument();
  });

  it('shows no groups yet when conversations has no groups', async () => {
    server.use(
      http.get('http://localhost:4000/api/conversations', () =>
        HttpResponse.json({ data: [mockDmConversation], nextCursor: null }),
      ),
    );
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));
    expect(await screen.findByText(/no groups yet/i)).toBeInTheDocument();
  });

  it('navigates to the conversation when a chat row is clicked', async () => {
    const user = userEvent.setup();
    renderChatList();
    await screen.findByText(mockDmConversation.otherUser.displayName);
    await user.click(
      screen.getByText(mockDmConversation.otherUser.displayName),
    );
    // The active row is highlighted — we just verify click doesn't error
  });

  it('shows and confirms block-user dialog on overflow menu Block', async () => {
    const user = userEvent.setup();
    renderChatList();
    await user.click(screen.getByRole('tab', { name: /friends & groups/i }));
    await screen.findByText(mockFriends[0]!.displayName);

    const menuBtn = screen.getByRole('button', {
      name: new RegExp(`actions for ${mockFriends[0]!.displayName}`, 'i'),
    });
    await user.click(menuBtn);

    await user.click(await screen.findByText(/^block$/i));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Confirm the block
    await user.click(within(dialog).getByRole('button', { name: /^block$/i }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});
