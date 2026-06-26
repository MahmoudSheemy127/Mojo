// Minimal smoke tests for chat-feature UI components — covers branches in
// TypingIndicator (label variants), MessageStatusIcon (read vs unread colour),
// EmptyChatState, MessageBubble, MessageComposer, and ChatHeader.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TypingIndicator } from './TypingIndicator';
import { MessageStatusIcon } from './MessageStatusIcon';
import { EmptyChatState } from './EmptyChatState';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { ChatHeader } from './ChatHeader';
import type { Message, ConversationSummary } from '@/types/entities';

describe('TypingIndicator', () => {
  it('renders nothing when names array is empty', () => {
    const { container } = render(<TypingIndicator names={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders single-name label', () => {
    render(<TypingIndicator names={['Alice']} />);
    expect(screen.getByText('Alice is typing…')).toBeInTheDocument();
  });

  it('renders two-name label', () => {
    render(<TypingIndicator names={['Alice', 'Bob']} />);
    expect(screen.getByText('Alice and Bob are typing…')).toBeInTheDocument();
  });

  it('renders several-people label for 3+ names', () => {
    render(<TypingIndicator names={['Alice', 'Bob', 'Charlie']} />);
    expect(screen.getByText('Several people are typing…')).toBeInTheDocument();
  });
});

describe('MessageStatusIcon', () => {
  it('renders sending status without accent colour', () => {
    render(<MessageStatusIcon status="sending" />);
    const icon = screen.getByTitle('Sending');
    expect(icon).toBeInTheDocument();
    expect(icon.className).not.toContain('text-accent');
  });

  it('renders sent status without accent colour', () => {
    render(<MessageStatusIcon status="sent" />);
    expect(screen.getByTitle('Sent')).toBeInTheDocument();
  });

  it('renders delivered status without accent colour', () => {
    render(<MessageStatusIcon status="delivered" />);
    expect(screen.getByTitle('Delivered')).toBeInTheDocument();
  });

  it('renders read status with accent colour', () => {
    render(<MessageStatusIcon status="read" />);
    const icon = screen.getByTitle('Read');
    expect(icon).toBeInTheDocument();
    expect(icon.className).toContain('text-accent');
  });

  it('renders failed status with error colour', () => {
    render(<MessageStatusIcon status="failed" />);
    const icon = screen.getByTitle('Failed');
    expect(icon).toBeInTheDocument();
    expect(icon.className).toContain('text-error');
  });
});

describe('EmptyChatState', () => {
  it('renders the conversation-start message with the provided name', () => {
    render(<EmptyChatState name="Aria" />);
    expect(
      screen.getByText(/start of your conversation with aria/i),
    ).toBeInTheDocument();
  });
});

// ─── MessageBubble ───────────────────────────────────────────────────────────

const baseMessage: Message = {
  id: 'm1',
  authorId: 'u1',
  authorName: 'Alice',
  body: 'Hello world',
  sentAt: '10:00',
  own: false,
};

describe('MessageBubble', () => {
  it('renders deleted placeholder, hides body', () => {
    render(<MessageBubble message={{ ...baseMessage, deleted: true }} />);
    expect(screen.getByText('This message was deleted')).toBeInTheDocument();
    expect(screen.queryByText('Hello world')).toBeNull();
  });

  it('renders message with header visible', () => {
    render(<MessageBubble message={baseMessage} showHeader />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('hides name/avatar on consecutive messages (showHeader=false)', () => {
    render(<MessageBubble message={baseMessage} showHeader={false} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).toBeNull();
  });

  it('shows status icon for own messages with a status', () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, own: true, status: 'sent' }}
      />,
    );
    expect(screen.getByTitle('Sent')).toBeInTheDocument();
  });

  it('does not show status icon for other-user messages', () => {
    render(<MessageBubble message={{ ...baseMessage, own: false, status: 'sent' }} />);
    expect(screen.queryByTitle('Sent')).toBeNull();
  });

  it('shows retry and delete buttons for failed messages', () => {
    const onRetry = vi.fn();
    const onDelete = vi.fn();
    render(
      <MessageBubble
        message={{ ...baseMessage, status: 'failed' }}
        onRetry={onRetry}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Retry')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('hides retry/delete buttons when callbacks not provided on failed', () => {
    render(
      <MessageBubble message={{ ...baseMessage, status: 'failed' }} />,
    );
    expect(screen.queryByText('Retry')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('shows dropdown menu for own non-failed messages with onDelete', () => {
    const onDelete = vi.fn();
    render(
      <MessageBubble
        message={{ ...baseMessage, own: true, status: 'sent' }}
        onDelete={onDelete}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Message actions' }),
    ).toBeInTheDocument();
  });

  it('hides dropdown menu for other-user messages', () => {
    const onDelete = vi.fn();
    render(<MessageBubble message={baseMessage} onDelete={onDelete} />);
    expect(
      screen.queryByRole('button', { name: 'Message actions' }),
    ).toBeNull();
  });
});

// ─── MessageComposer ─────────────────────────────────────────────────────────

describe('MessageComposer', () => {
  it('shows blocked notice when blocked=true', () => {
    render(<MessageComposer recipientName="Bob" blocked />);
    expect(
      screen.getByText(/can't send messages to this conversation/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders normal composer when not blocked', () => {
    render(<MessageComposer recipientName="Aria" />);
    expect(
      screen.getByRole('textbox', { name: 'Message Aria' }),
    ).toBeInTheDocument();
  });

  it('calls onSend with content when Enter is pressed', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('inserts newline on Shift+Enter without sending', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onSend={onSend} />);
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onSend when Send button is clicked', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onSend={onSend} />);
    await user.type(screen.getByRole('textbox'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('clears draft after successful send', async () => {
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onSend={vi.fn()} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'Hello');
    await user.keyboard('{Enter}');
    expect(textarea.value).toBe('');
  });

  it('does not send empty or whitespace-only content', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onSend={onSend} />);
    await user.type(screen.getByRole('textbox'), '   ');
    await user.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onTyping on every keystroke', async () => {
    const onTyping = vi.fn();
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onTyping={onTyping} />);
    await user.type(screen.getByRole('textbox'), 'ab');
    expect(onTyping).toHaveBeenCalledTimes(2);
  });

  it('calls onBlur when textarea loses focus', async () => {
    const onBlur = vi.fn();
    const user = userEvent.setup();
    render(<MessageComposer recipientName="Bob" onBlur={onBlur} />);
    const textarea = screen.getByRole('textbox');
    await user.click(textarea);
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });

  it('disables Send button when draft is empty', () => {
    render(<MessageComposer recipientName="Bob" onSend={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('disables textarea and Send when disabled=true', () => {
    render(<MessageComposer recipientName="Bob" disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });
});

// ─── ChatHeader ──────────────────────────────────────────────────────────────

const dmConversation: ConversationSummary = {
  id: 'c1',
  type: 'dm',
  name: 'Aria',
  presence: 'online',
};

const groupConversation: ConversationSummary = {
  id: 'c2',
  type: 'group',
  name: 'Team Chat',
};

describe('ChatHeader', () => {
  it('renders DM header with presence text', () => {
    render(
      <ChatHeader conversation={dmConversation} onInvite={vi.fn()} />,
    );
    expect(screen.getByText('Aria')).toBeInTheDocument();
    // 'Online' may appear in both the subtitle and the avatar tooltip
    expect(screen.getAllByText('Online').length).toBeGreaterThan(0);
  });

  it('renders DM header without presence when absent', () => {
    render(
      <ChatHeader
        conversation={{ ...dmConversation, presence: undefined }}
        onInvite={vi.fn()}
      />,
    );
    expect(screen.getByText('Aria')).toBeInTheDocument();
  });

  it('renders group header with "Group" subtitle', () => {
    render(
      <ChatHeader conversation={groupConversation} onInvite={vi.fn()} />,
    );
    expect(screen.getByText('Team Chat')).toBeInTheDocument();
    expect(screen.getByText('Group')).toBeInTheDocument();
  });

  it('shows "Create group" button for DMs', () => {
    render(
      <ChatHeader conversation={dmConversation} onInvite={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'Create group' }),
    ).toBeInTheDocument();
  });

  it('shows "Invite" button for groups', () => {
    render(
      <ChatHeader conversation={groupConversation} onInvite={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'Invite' }),
    ).toBeInTheDocument();
  });

  it('calls onInvite when invite button is clicked', async () => {
    const onInvite = vi.fn();
    const user = userEvent.setup();
    render(<ChatHeader conversation={groupConversation} onInvite={onInvite} />);
    await user.click(screen.getByRole('button', { name: 'Invite' }));
    expect(onInvite).toHaveBeenCalled();
  });

  it('renders actions menu with Block option for DMs', async () => {
    const onBlock = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatHeader
        conversation={dmConversation}
        onInvite={vi.fn()}
        onBlock={onBlock}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Conversation actions' }),
    );
    expect(screen.getByText('Block user')).toBeInTheDocument();
  });

  it('renders actions menu with Leave group for non-admin group', async () => {
    const onLeaveGroup = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatHeader
        conversation={groupConversation}
        onInvite={vi.fn()}
        onLeaveGroup={onLeaveGroup}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Conversation actions' }),
    );
    expect(screen.getByText('Leave group')).toBeInTheDocument();
  });

  it('renders Group settings for admin', async () => {
    const onSettings = vi.fn();
    const user = userEvent.setup();
    render(
      <ChatHeader
        conversation={groupConversation}
        isAdmin
        onInvite={vi.fn()}
        onOpenGroupSettings={onSettings}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Conversation actions' }),
    );
    expect(screen.getByText('Group settings')).toBeInTheDocument();
  });

  it('hides actions menu when no menu items', () => {
    render(
      <ChatHeader conversation={dmConversation} onInvite={vi.fn()} />,
    );
    expect(
      screen.queryByRole('button', { name: 'Conversation actions' }),
    ).toBeNull();
  });
});
