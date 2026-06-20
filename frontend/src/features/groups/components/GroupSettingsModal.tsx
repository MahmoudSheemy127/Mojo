// src/features/groups/components/GroupSettingsModal.tsx
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { groupMembers } from '@/lib/placeholder';
import { MemberRow } from './MemberRow';

interface GroupSettingsModalProps {
  open: boolean;
  onClose: () => void;
  groupName?: string | undefined;
}

type SettingsTab = 'profile' | 'members' | 'danger';
type Confirm = 'leave' | 'delete' | null;

/** Tabbed group management: profile, members/roles, danger zone (FR-20–23). */
export function GroupSettingsModal({
  open,
  onClose,
  groupName = 'Design Guild',
}: GroupSettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [name, setName] = useState(groupName);
  const [description, setDescription] = useState('');
  const [confirm, setConfirm] = useState<Confirm>(null);

  return (
    <Modal open={open} onClose={onClose} aria-label="Group settings" className="max-w-lg">
      <ModalHeader title="Group settings" onClose={onClose} />
      <div className="px-4 pt-3">
        <Tabs
          aria-label="Group settings sections"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'profile', label: 'Profile' },
            { value: 'members', label: 'Members' },
            { value: 'danger', label: 'Danger zone' },
          ]}
        />
      </div>

      <div className="max-h-[60vh] overflow-y-auto p-4">
        {tab === 'profile' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={name} size="lg" square />
              <IconButton aria-label="Change group icon">
                <span aria-hidden>📷</span>
              </IconButton>
            </div>
            <Input
              label="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              counter={`${description.length}/200`}
              maxLength={200}
            />
            <div className="flex justify-end">
              <Button variant="primary">Save changes</Button>
            </div>
          </div>
        )}

        {tab === 'members' && (
          <ul className="flex flex-col gap-0.5">
            {groupMembers.map((m) => (
              <li key={m.id}>
                <MemberRow member={m} manageable />
              </li>
            ))}
          </ul>
        )}

        {tab === 'danger' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4 rounded-card border border-bg-active p-3">
              <div>
                <p className="text-sm font-medium text-text-normal">Leave group</p>
                <p className="text-xs text-text-muted">
                  You’ll need a new invite to rejoin.
                </p>
              </div>
              <Button variant="secondary" onClick={() => setConfirm('leave')}>
                Leave
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-card border border-danger/40 p-3">
              <div>
                <p className="text-sm font-medium text-text-normal">Delete group</p>
                <p className="text-xs text-text-muted">
                  Permanently removes the group for everyone.
                </p>
              </div>
              <Button variant="danger" onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm === 'leave'}
        title="Leave group"
        message={`Leave ${name}?`}
        confirmLabel="Leave"
        destructive
        onConfirm={() => {}}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete group"
        message={`Permanently delete ${name}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {}}
        onClose={() => setConfirm(null)}
      />
    </Modal>
  );
}
