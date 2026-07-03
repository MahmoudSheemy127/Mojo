// src/features/groups/components/CreateGroupModal.tsx
import { useRef, useState } from 'react';
import type { PublicUser } from '@/types/api';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Spinner } from '@/components/ui/Spinner';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { useContacts } from '@/features/contacts/hooks/useContacts';
import { useOverlay } from '@/layouts/overlayContext';
import { validateAvatarFile } from '@/features/settings/schemas';
import { useCreateGroup } from '../hooks/useCreateGroup';
import { uploadGroupAvatar } from '../api';

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected members — e.g. when launched from a DM. */
  seededMembers?: PublicUser[] | undefined;
}

/** Create group form: icon, name, member picker, create button (FR-18). */
export function CreateGroupModal({
  open,
  onClose,
  seededMembers = [],
}: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState<PublicUser[]>(seededMembers);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: friends = [] } = useContacts();
  const createGroup = useCreateGroup();
  const { openModal } = useOverlay();

  const canCreate = name.trim().length > 0 && !createGroup.isPending;

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateAvatarFile(file);
    if (error) {
      setAvatarError(error);
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
  }

  function handleCreate() {
    if (!canCreate) return;
    createGroup.mutate(
      { name: name.trim(), memberIds: members.map((m) => m.id) },
      {
        onSuccess: (group) => {
          if (avatarFile) {
            // Upload avatar after group creation; non-blocking
            void uploadGroupAvatar(group.id, avatarFile).catch(() => {});
          }
          onClose();
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} aria-label="Create group">
      <ModalHeader title="Create group" onClose={onClose} />
      <div className="flex flex-col gap-4 p-4">
        {/* Group icon uploader */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Change group icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={createGroup.isPending}
            className="relative shrink-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Avatar
              name={name || 'New group'}
              src={avatarPreview ?? undefined}
              size="lg"
              square
            />
            <span className="absolute inset-0 flex items-center justify-center rounded-card bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity hover:opacity-100">
              Change
            </span>
          </button>
          {avatarPreview && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={createGroup.isPending}
            >
              Remove
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            aria-label="Upload group icon"
            onChange={handleAvatarChange}
          />
        </div>
        {avatarError && (
          <p role="alert" className="text-xs text-danger">
            {avatarError}
          </p>
        )}

        <Input
          label="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Weekend Crew"
          maxLength={80}
          disabled={createGroup.isPending}
          helperText={`${name.length}/80`}
          error={
            createGroup.isError
              ? "Couldn't create the group. Please try again."
              : undefined
          }
        />

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Add members
          </p>
          {friends.length === 0 ? (
            <p className="py-3 text-center text-sm text-text-muted">
              No friends yet.{' '}
              <button
                type="button"
                className="underline hover:text-text-normal"
                onClick={() => { onClose(); openModal('find-friends'); }}
              >
                Find friends
              </button>{' '}
              to add them here.
            </p>
          ) : (
            <MemberPicker
              candidates={friends}
              value={members}
              onChange={setMembers}
              disabled={createGroup.isPending}
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-bg-deepest px-4 py-3">
        <Button variant="ghost" onClick={onClose} disabled={createGroup.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!canCreate}
          onClick={handleCreate}
        >
          {createGroup.isPending ? <Spinner className="text-white" /> : 'Create group'}
        </Button>
      </div>
    </Modal>
  );
}
