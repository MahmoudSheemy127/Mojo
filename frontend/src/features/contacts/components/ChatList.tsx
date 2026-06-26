// src/features/contacts/components/ChatList.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOverlay } from '@/layouts/overlayContext';
import type { Conversation, DmConversation, GroupConversation, PublicUser } from '@/types/api';
import type { ConversationSummary } from '@/types/entities';
import { toUiPresence } from '@/features/presence/presence';
import { formatRelative } from '@/utils/formatDate';
import { useContacts } from '../hooks/useContacts';
import { useConversations, useOpenDm } from '../hooks/useConversations';
import { useRemoveFriend } from '../hooks/useRemoveFriend';
import { useBlockUser } from '../hooks/useBlockUser';
import { ChatSessionRow } from './ChatSessionRow';
import { FriendRow } from './FriendRow';
import { GroupRow } from './GroupRow';
import { useAuth } from '@/hooks/useAuth';

type SidebarTab = 'chats' | 'directory';

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-avatar" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function toConversationSummary(
  conv: Conversation,
  currentUserId: string,
): ConversationSummary {
  if (conv.type === 'dm') {
    const dm = conv as DmConversation;
    const lastPreview = dm.lastMessage
      ? dm.lastMessage.senderId === currentUserId
        ? `You: ${dm.lastMessage.content ?? ''}`
        : dm.lastMessage.content ?? ''
      : undefined;
    return {
      id: dm.id,
      type: 'dm',
      name: dm.otherUser.displayName,
      avatarUrl: dm.otherUser.avatarUrl ?? undefined,
      presence: toUiPresence(dm.otherUser.presence),
      lastMessagePreview: lastPreview ?? undefined,
      lastMessageAt: dm.lastMessage
        ? formatRelative(dm.lastMessage.createdAt)
        : undefined,
      unreadCount: dm.unreadCount,
    };
  }

  const grp = conv as GroupConversation;
  const lastPreview = grp.lastMessage
    ? grp.lastMessage.senderId === currentUserId
      ? `You: ${grp.lastMessage.content ?? ''}`
      : grp.lastMessage.content ?? ''
    : undefined;
  return {
    id: grp.id,
    type: 'group',
    name: grp.name,
    avatarUrl: grp.avatarUrl ?? undefined,
    lastMessagePreview: lastPreview ?? undefined,
    lastMessageAt: grp.lastMessage
      ? formatRelative(grp.lastMessage.createdAt)
      : undefined,
    unreadCount: grp.unreadCount,
  };
}

/** Left column: action buttons + tabs + active tab content. */
export function ChatList() {
  const [tab, setTab] = useState<SidebarTab>('chats');
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const { openModal } = useOverlay();

  const openConversation = (id: string) => navigate(`/c/${id}`);

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-r border-bg-deepest bg-bg-sidebar">
      <div className="flex gap-2 p-3">
        <Button
          size="sm"
          variant="secondary"
          fullWidth
          onClick={() => openModal('create-group')}
        >
          + Create group
        </Button>
        <Button
          size="sm"
          variant="secondary"
          fullWidth
          onClick={() => openModal('find-friends')}
        >
          Find friends
        </Button>
      </div>

      <div className="px-3 pb-2">
        <Tabs
          aria-label="Chat list sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'chats', label: 'Chats' },
            { value: 'directory', label: 'Friends & groups' },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {tab === 'chats' && (
          <ChatsTab
            activeId={conversationId}
            onSelect={openConversation}
            onFindFriends={() => openModal('find-friends')}
          />
        )}
        {tab === 'directory' && <DirectoryTab onOpen={openConversation} />}
      </div>
    </aside>
  );
}

function ChatsTab({
  activeId,
  onSelect,
  onFindFriends,
}: {
  activeId: string | undefined;
  onSelect: (id: string) => void;
  onFindFriends: () => void;
}) {
  const { user } = useAuth();
  const {
    data: conversations,
    isLoading,
    isError,
    refetch,
  } = useConversations();

  if (isLoading) {
    return <ListSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2 px-2 py-3">
        <p className="text-sm text-text-muted">Couldn&apos;t load conversations.</p>
        <Button size="sm" variant="secondary" onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
        <p className="text-sm text-text-muted">
          No conversations yet. Find a friend to start chatting.
        </p>
        <Button size="sm" variant="primary" onClick={onFindFriends}>
          Find friends
        </Button>
      </div>
    );
  }

  const summaries = conversations.map((c) =>
    toConversationSummary(c, user?.id ?? ''),
  );

  return (
    <ul className="flex flex-col gap-0.5">
      {summaries.map((c) => (
        <li key={c.id}>
          <ChatSessionRow
            conversation={c}
            active={c.id === activeId}
            onSelect={() => onSelect(c.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function DirectoryTab({ onOpen }: { onOpen: (id: string) => void }) {
  const {
    data: friends,
    isLoading: friendsLoading,
    isError: friendsError,
    refetch: refetchFriends,
  } = useContacts();
  const {
    data: conversations,
    isLoading: convsLoading,
    isError: convsError,
    refetch: refetchConvs,
  } = useConversations();
  const removeFriend = useRemoveFriend();
  const blockUser = useBlockUser();
  const openDmMutation = useOpenDm();

  const { user } = useAuth();
  const groups = (conversations ?? [])
    .filter((c) => c.type === 'group')
    .map((c) => toConversationSummary(c, user?.id ?? ''));

  const [confirmRemove, setConfirmRemove] = useState<PublicUser | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<PublicUser | null>(null);

  return (
    <div className="flex flex-col gap-4 py-1">
      <section aria-labelledby="friends-heading">
        <h3
          id="friends-heading"
          className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted"
        >
          Friends
        </h3>

        {friendsLoading ? (
          <ListSkeleton />
        ) : friendsError ? (
          <div className="flex flex-col items-start gap-2 px-2 py-3">
            <p className="text-sm text-text-muted">Couldn&apos;t load friends.</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refetchFriends()}
            >
              Retry
            </Button>
          </div>
        ) : !friends || friends.length === 0 ? (
          <p className="px-2 py-3 text-sm text-text-muted">No friends yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {friends.map((f) => (
              <li key={f.id}>
                <FriendRow
                  friend={{
                    id: f.id,
                    username: f.username,
                    displayName: f.displayName,
                    avatarUrl: f.avatarUrl ?? undefined,
                    presence: toUiPresence(f.presence),
                  }}
                  onMessage={() => openDmMutation.mutate(f.id)}
                  onBlock={() => setConfirmBlock(f)}
                  onRemove={() => setConfirmRemove(f)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="groups-heading">
        <h3
          id="groups-heading"
          className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted"
        >
          Groups
        </h3>
        {convsLoading ? (
          <ListSkeleton />
        ) : convsError ? (
          <div className="flex flex-col items-start gap-2 px-2 py-3">
            <p className="text-sm text-text-muted">Couldn&apos;t load groups.</p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refetchConvs()}
            >
              Retry
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 py-3 text-sm text-text-muted">No groups yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {groups.map((g) => (
              <li key={g.id}>
                <GroupRow
                  group={g}
                  onOpen={() => onOpen(g.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove friend?"
        message={
          confirmRemove
            ? `${confirmRemove.displayName} will be removed from your friends list.`
            : ''
        }
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmRemove) removeFriend.mutate(confirmRemove.id);
        }}
        onClose={() => setConfirmRemove(null)}
      />

      <ConfirmDialog
        open={confirmBlock !== null}
        title="Block user?"
        message={
          confirmBlock
            ? `${confirmBlock.displayName} will be blocked and removed from your friends list.`
            : ''
        }
        confirmLabel="Block"
        onConfirm={() => {
          if (confirmBlock) blockUser.mutate(confirmBlock.id);
        }}
        onClose={() => setConfirmBlock(null)}
      />
    </div>
  );
}
