// src/features/groups/components/CreateGroupModal.tsx
import { useState } from 'react';
import type { User } from '@/types/entities';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { friends as candidateFriends } from '@/lib/placeholder';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected members (e.g. when launched from a DM). */
  seededMembers?: User[] | undefined;
}

/** Create group form: icon, name, member picker, create button (FR-18). */
export function CreateGroupModal({
  open,
  onClose,
  seededMembers = [],
}: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<User[]>(seededMembers);

  const canCreate = name.trim().length > 0;

  return (
    <Modal open={open} onClose={onClose} aria-label="Create group">
      <ModalHeader title="Create group" onClose={onClose} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={name || 'New group'} size="lg" square />
          <IconButton aria-label="Upload group icon">
            <span aria-hidden>📷</span>
          </IconButton>
        </div>

        <Input
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend Crew"
        />

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Add members
          </p>
          <MemberPicker
            candidates={candidateFriends}
            value={members}
            onChange={setMembers}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-bg-deepest px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!canCreate}>
          Create group
        </Button>
      </div>
    </Modal>
  );
}
