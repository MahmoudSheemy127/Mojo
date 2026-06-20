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
import { OverlayContext, type ModalType } from './overlayContext';

/**
 * Authenticated shell: Header + ChatList + middle region (<Outlet/>), plus the
 * overlay layer. A single `activeModal` enforces one-modal-at-a-time; opening a
 * new one replaces the previous. State is local (replaced by uiStore later).
 */
export default function AppLayout() {
  const [activeModal, setActiveModal] = useState<ModalType | null>(null);

  const overlay = useMemo(
    () => ({
      activeModal,
      openModal: (type: ModalType) => setActiveModal(type),
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
            {/* Toggle the status prop to preview the reconnecting banner. */}
            <ConnectionStatusBanner status="connected" />
            <Outlet />
          </main>
        </div>
      </div>

      {/* Overlay layer — one modal at a time. */}
      <FindFriendsModal open={activeModal === 'find-friends'} onClose={close} />
      <CreateGroupModal open={activeModal === 'create-group'} onClose={close} />
      <InviteMembersModal
        open={activeModal === 'invite-members'}
        onClose={close}
      />
      <GroupSettingsModal
        open={activeModal === 'group-settings'}
        onClose={close}
      />
    </OverlayContext.Provider>
  );
}
