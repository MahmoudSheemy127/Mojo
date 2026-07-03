// src/layouts/AppLayout.tsx
import { useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { HeaderBar } from '@/components/shared/HeaderBar';
import { ConnectionStatusBanner } from '@/components/shared/ConnectionStatusBanner';
import { ChatList, FindFriendsModal } from '@/features/contacts';
import {
  CreateGroupModal,
  InviteMembersModal,
  GroupSettingsModal,
} from '@/features/groups';
import { usePresenceFeed } from '@/features/presence/hooks/usePresenceFeed';
import { usePresence } from '@/features/presence/hooks/usePresence';
import { useSocket } from '@/hooks/useSocket';
import { useSocketStore } from '@/store/socketStore';
import { OverlayContext, type ModalType } from './overlayContext';

/**
 * Authenticated shell: Header + ChatList + middle region (<Outlet/>), plus the
 * overlay layer. A single `activeModal` enforces one-modal-at-a-time; opening a
 * new one replaces the previous. State is local (replaced by uiStore later).
 */
export default function AppLayout() {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const socketStatus = useSocketStore((s) => s.status);

  useSocket();
  usePresenceFeed();
  usePresence();

  const overlay = useMemo(
    () => ({
      activeModal,
      openModal: (type: ModalType, groupId?: string) => {
        setActiveModal(type);
        if (groupId !== undefined) setActiveGroupId(groupId);
      },
      closeModal: () => setActiveModal(null),
    }),
    [activeModal],
  );

  const close = () => setActiveModal(null);

  return (
    <OverlayContext.Provider value={overlay}>
      <div className="flex h-screen flex-col bg-bg-deepest">
        <HeaderBar />
        <div className="flex min-h-0 flex-1">
          <ChatList />
          <main className="flex min-w-0 flex-1 flex-col">
            <ConnectionStatusBanner status={socketStatus} />
            <Outlet />
          </main>
        </div>
      </div>

      {/* Overlay layer — one modal at a time. */}
      <FindFriendsModal open={activeModal === 'find-friends'} onClose={close} />
      <CreateGroupModal open={activeModal === 'create-group'} onClose={close} />
      {activeGroupId && (
        <InviteMembersModal
          open={activeModal === 'invite-members'}
          onClose={close}
          groupId={activeGroupId}
        />
      )}
      {activeGroupId && (
        <GroupSettingsModal
          open={activeModal === 'group-settings'}
          onClose={close}
          groupId={activeGroupId}
        />
      )}
    </OverlayContext.Provider>
  );
}
