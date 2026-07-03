// src/features/chat/components/ChatWindow.tsx
import { useMemo, useState, useCallback } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOverlay } from '@/layouts/overlayContext';
import { useAuthStore } from '@/store/authStore';
import { toUiPresence } from '@/features/presence/presence';
import { useConversation } from '../hooks/useConversation';
import { useMessages } from '../hooks/useMessages';
import { useSendMessage } from '../hooks/useSendMessage';
import { useDeleteMessage } from '../hooks/useDeleteMessage';
import { useTyping } from '../hooks/useTyping';
import { useReadReceipts } from '../hooks/useReadReceipts';
import { ChatHeader } from './ChatHeader';
import { MessageHistory } from './MessageHistory';
import { TypingIndicator } from './TypingIndicator';
import { MessageComposer } from './MessageComposer';
import type { PublicUser } from '@/types/api';
import type { ConversationSummary } from '@/types/entities';

interface ChatWindowProps {
  conversationId: string;
}

type Confirm = 'block' | 'leave' | null;

/** Top-level messaging surface: header + history + composer. */
export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { openModal } = useOverlay();
  const currentUser = useAuthStore((s) => s.currentUser);
  const [confirm, setConfirm] = useState<Confirm>(null);

  // Load conversation metadata
  const { data: conversation, isLoading: convLoading } =
    useConversation(conversationId);

  // Build a participants map for name/avatar resolution
  const participants = useMemo(() => {
    const map = new Map<string, Pick<PublicUser, 'displayName' | 'avatarUrl'>>();
    if (currentUser) {
      map.set(currentUser.id, {
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
      });
    }
    if (conversation?.type === 'dm') {
      map.set(conversation.otherUser.id, {
        displayName: conversation.otherUser.displayName,
        avatarUrl: conversation.otherUser.avatarUrl,
      });
    }
    return map;
  }, [currentUser, conversation]);

  // participants name map for typing indicator
  const participantsNames = useMemo(() => {
    const map = new Map<string, string>();
    participants.forEach((u, id) => map.set(id, u.displayName));
    return map;
  }, [participants]);

  const {
    messages,
    isLoading: messagesLoading,
    isLoadingOlder,
    hasOlderMessages,
    fetchNextPage,
  } = useMessages(conversationId, participants);

  const sendMutation = useSendMessage(conversationId);
  const deleteMutation = useDeleteMessage(conversationId);
  const { typingNames, onKeyPress, onStop } = useTyping(
    conversationId,
    participantsNames,
  );

  useReadReceipts(conversationId, messages);

  const handleSend = useCallback(
    (content: string) => {
      onStop();
      sendMutation.mutate({
        content,
        clientNonce: crypto.randomUUID(),
      });
    },
    [onStop, sendMutation],
  );

  const handleRetry = useCallback(
    (clientNonce: string, content: string) => {
      sendMutation.mutate({ content, clientNonce });
    },
    [sendMutation],
  );

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      deleteMutation.mutate(messageId);
    },
    [deleteMutation],
  );

  // Derive a ConversationSummary for ChatHeader (legacy shape)
  const conversationSummary = useMemo((): ConversationSummary => {
    if (!conversation) {
      return { id: conversationId, type: 'dm', name: '…' };
    }
    if (conversation.type === 'dm') {
      return {
        id: conversation.id,
        type: 'dm',
        name: conversation.otherUser.displayName,
        avatarUrl: conversation.otherUser.avatarUrl ?? undefined,
        presence: toUiPresence(conversation.otherUser.presence),
      };
    }
    return {
      id: conversation.id,
      type: 'group',
      name: conversation.name,
      avatarUrl: conversation.avatarUrl ?? undefined,
    };
  }, [conversation, conversationId]);

  const isGroup = conversationSummary.type === 'group';
  const isAdmin =
    conversation?.type === 'group' && conversation.role === 'admin';

  const historyState = convLoading || messagesLoading ? 'loading' : 'ready';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg-chat">
      <ChatHeader
        conversation={conversationSummary}
        isAdmin={isAdmin}
        onInvite={() =>
          openModal(
            isGroup ? 'invite-members' : 'create-group',
            isGroup ? conversationId : undefined,
          )
        }
        onOpenGroupSettings={
          isAdmin ? () => openModal('group-settings', conversationId) : undefined
        }
        onLeaveGroup={isGroup ? () => setConfirm('leave') : undefined}
        onBlock={!isGroup ? () => setConfirm('block') : undefined}
        onRemoveFriend={!isGroup ? () => {} : undefined}
      />

      <MessageHistory
        messages={messages}
        conversationName={conversationSummary.name}
        state={historyState}
        isLoadingOlder={isLoadingOlder}
        hasOlderMessages={hasOlderMessages}
        onLoadOlder={() => void fetchNextPage()}
        onDeleteMessage={handleDeleteMessage}
        onRetryMessage={handleRetry}
      />

      {typingNames.length > 0 && <TypingIndicator names={typingNames} />}

      <MessageComposer
        recipientName={conversationSummary.name}
        onSend={handleSend}
        onTyping={onKeyPress}
        onBlur={onStop}
      />

      <ConfirmDialog
        open={confirm === 'block'}
        title="Block user"
        message={`Block ${conversationSummary.name}? They won't be able to message you.`}
        confirmLabel="Block"
        destructive
        onConfirm={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'leave'}
        title="Leave group"
        message={`Leave ${conversationSummary.name}? You'll need a new invite to rejoin.`}
        confirmLabel="Leave"
        destructive
        onConfirm={() => setConfirm(null)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
