// src/features/contacts/components/ChatList.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { useOverlay } from '@/layouts/overlayContext';
import {
  conversations as placeholderConversations,
  friends as placeholderFriends,
  groups as placeholderGroups,
} from '@/lib/placeholder';
import { ChatSessionRow } from './ChatSessionRow';
import { FriendRow } from './FriendRow';
import { GroupRow } from './GroupRow';

type SidebarTab = 'chats' | 'directory';
type ListState = 'loading' | 'error' | 'ready';

interface ChatListProps {
  /** Drives the visual state of the lists. Defaults to populated. */
  state?: ListState | undefined;
}

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

/** Left column: action buttons + tabs + active tab content. */
export function ChatList({ state = 'ready' }: ChatListProps) {
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
        {state === 'loading' && <ListSkeleton />}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-2 px-2 py-8 text-center">
            <p className="text-sm text-text-muted">Couldn’t load your chats.</p>
            <Button size="sm" variant="secondary">
              Retry
            </Button>
          </div>
        )}

        {state === 'ready' && tab === 'chats' && (
          <ChatsTab
            activeId={conversationId}
            onSelect={openConversation}
            onFindFriends={() => openModal('find-friends')}
          />
        )}

        {state === 'ready' && tab === 'directory' && (
          <DirectoryTab onOpen={openConversation} />
        )}
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
  if (placeholderConversations.length === 0) {
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

  return (
    <ul className="flex flex-col gap-0.5">
      {placeholderConversations.map((c) => (
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
  return (
    <div className="flex flex-col gap-4 py-1">
      <section>
        <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Friends
        </h3>
        {placeholderFriends.length === 0 ? (
          <p className="px-2 py-3 text-sm text-text-muted">No friends yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {placeholderFriends.map((f) => (
              <li key={f.id}>
                <FriendRow
                  friend={f}
                  onMessage={() => onOpen(`c-${f.username}`)}
                  onBlock={() => {}}
                  onRemove={() => {}}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          Groups
        </h3>
        {placeholderGroups.length === 0 ? (
          <p className="px-2 py-3 text-sm text-text-muted">No groups yet.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {placeholderGroups.map((g) => (
              <li key={g.id}>
                <GroupRow
                  group={g}
                  onOpen={() => onOpen(g.id)}
                  onLeave={() => {}}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
