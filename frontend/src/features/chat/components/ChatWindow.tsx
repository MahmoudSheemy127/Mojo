// src/features/chat/components/ChatWindow.tsx
import { useState } from 'react';
import type { ConversationSummary } from '@/types/entities';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOverlay } from '@/layouts/overlayContext';
import { conversations, messages as placeholderMessages } from '@/lib/placeholder';
import { ChatHeader } from './ChatHeader';
import { MessageHistory } from './MessageHistory';
import { TypingIndicator } from './TypingIndicator';
import { MessageComposer } from './MessageComposer';

interface ChatWindowProps {
  conversationId: string;
}

/** Resolve a conversation from the placeholder set, falling back to a DM stub. */
function resolveConversation(id: string): ConversationSummary {
  const found = conversations.find((c) => c.id === id);
  if (found) return found;
  return { id, type: 'dm', name: 'Conversation', presence: 'offline' };
}

type Confirm = 'block' | 'leave' | null;

/** Top-level messaging surface: header + history + composer. */
export function ChatWindow({ conversationId }: ChatWindowProps) {
  const conversation = resolveConversation(conversationId);
  const isGroup = conversation.type === 'group';
  const { openModal } = useOverlay();
  const [confirm, setConfirm] = useState<Confirm>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-chat">
      <ChatHeader
        conversation={conversation}
        isAdmin={isGroup}
        onInvite={() =>
          openModal(isGroup ? 'invite-members' : 'create-group')
        }
        onOpenGroupSettings={
          isGroup ? () => openModal('group-settings') : undefined
        }
        onLeaveGroup={isGroup ? () => setConfirm('leave') : undefined}
        onBlock={!isGroup ? () => setConfirm('block') : undefined}
        onRemoveFriend={!isGroup ? () => {} : undefined}
      />

      <MessageHistory
        messages={placeholderMessages}
        conversationName={conversation.name}
      />

      {conversation.typing && <TypingIndicator names={[conversation.name]} />}

      <MessageComposer recipientName={conversation.name} />

      <ConfirmDialog
        open={confirm === 'block'}
        title="Block user"
        message={`Block ${conversation.name}? They won’t be able to message you.`}
        confirmLabel="Block"
        destructive
        onConfirm={() => {}}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        title="Leave group"
        message={`Leave ${conversation.name}? You’ll need a new invite to rejoin.`}
        confirmLabel="Leave"
        destructive
        onConfirm={() => {}}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
