// src/features/groups/components/InviteMembersModal.tsx
import { useState } from 'react';
import type { User } from '@/types/entities';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { friends as candidateFriends } from '@/lib/placeholder';

interface InviteMembersModalProps {
  open: boolean;
  onClose: () => void;
}

const INVITE_LINK = 'https://mojo.app/invite/x7Qz-placeholder';

/** Invite members: member picker + shareable invite link (FR-19). */
export function InviteMembersModal({ open, onClose }: InviteMembersModalProps) {
  const [members, setMembers] = useState<User[]>([]);

  return (
    <Modal open={open} onClose={onClose} aria-label="Invite members">
      <ModalHeader title="Invite members" onClose={onClose} />
      <div className="flex flex-col gap-4 p-4">
        <MemberPicker
          candidates={candidateFriends}
          value={members}
          onChange={setMembers}
          placeholder="Search friends to invite…"
        />

        <div className="flex items-end gap-2">
          <Input
            label="Invite link"
            value={INVITE_LINK}
            readOnly
            className="flex-1"
          />
          <Button variant="secondary">Copy</Button>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-bg-deepest px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={members.length === 0}>
          Send invites
        </Button>
      </div>
    </Modal>
  );
}
