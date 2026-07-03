// src/features/groups/components/GroupSettingsModal.tsx
import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MemberRow } from './MemberRow';
import {
  useGroupSettings,
  useGroup,
  useGroupMembers,
  useUpdateGroup,
  useDeleteGroup,
  useChangeMemberRole,
  useRemoveMember,
} from '../hooks/useGroupSettings';
import { useLeaveGroup } from '../hooks/useLeaveGroup';
import { validateAvatarFile } from '@/features/settings/schemas';
import { uploadGroupAvatar } from '../api';

interface GroupSettingsModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
}

type SettingsTab = 'profile' | 'members' | 'danger';
type Confirm = 'leave' | 'delete' | { removeMemberId: string } | null;

/** Tabbed group management: profile, members/roles, danger zone (FR-20–23). */
export function GroupSettingsModal({
  open,
  onClose,
  groupId,
}: GroupSettingsModalProps) {
  const [tab, setTab] = useState<SettingsTab>('profile');
  const [memberFilter, setMemberFilter] = useState('');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Socket subscriptions (real-time updates) ───────────────────
  useGroupSettings(groupId, { onDemoted: onClose });

  // ── Data fetching ───────────────────────────────────────────────
  const { data: group, isLoading: groupLoading } = useGroup(groupId);
  const { data: members = [], isLoading: membersLoading } = useGroupMembers(groupId);

  // ── Profile form ───────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const isDirty =
    group !== undefined &&
    (name !== group.name || description !== (group.description ?? '') || avatarFile !== null);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description ?? '');
    }
  }, [group]);

  // ── Mutations ───────────────────────────────────────────────────
  const updateGroup = useUpdateGroup(groupId);
  const deleteGroup = useDeleteGroup(groupId);
  const changeRole = useChangeMemberRole(groupId);
  const removeMember = useRemoveMember(groupId);
  const leaveGroup = useLeaveGroup(groupId);

  const displayName = group?.name ?? 'Group';

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const error = validateAvatarFile(file);
    if (error) { setAvatarError(error); return; }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
  }

  async function handleSaveProfile() {
    if (!isDirty || updateGroup.isPending || avatarUploading) return;
    let avatarId: string | undefined;
    if (avatarFile) {
      setAvatarUploading(true);
      try {
        const res = await uploadGroupAvatar(groupId, avatarFile);
        avatarId = res.avatarId;
        setAvatarFile(null);
      } catch {
        setAvatarError("Couldn't upload avatar. Please try again.");
        setAvatarUploading(false);
        return;
      }
      setAvatarUploading(false);
    }
    updateGroup.mutate({ name: name.trim(), description: description || null, avatarId: avatarId ?? null });
  }

  // Filter members in the members tab
  const filteredMembers = members.filter((m) => {
    const q = memberFilter.trim().toLowerCase();
    if (!q) return true;
    return (
      m.user.displayName.toLowerCase().includes(q) ||
      m.user.username.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        aria-label="Group settings"
        className="max-w-lg"
      >
        <ModalHeader
          title={`Group settings — ${displayName}`}
          onClose={onClose}
        />
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
          {/* ── Profile tab ── */}
          {tab === 'profile' && (
            <div className="flex flex-col gap-4">
              {groupLoading ? (
                <>
                  <Skeleton className="h-20 w-20 rounded-card" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Change group avatar"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={updateGroup.isPending}
                      className="relative shrink-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      <Avatar
                        name={name || displayName}
                        src={avatarPreview ?? group?.avatarUrl ?? undefined}
                        size="lg"
                        square
                      />
                      <span className="absolute inset-0 flex items-center justify-center rounded-card bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity hover:opacity-100">
                        Change
                      </span>
                    </button>
                    {(avatarPreview ?? group?.avatarUrl) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveAvatar}
                        disabled={updateGroup.isPending}
                      >
                        Remove
                      </Button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      aria-label="Upload group avatar"
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
                    error={
                      updateGroup.isError
                        ? "Couldn't save. Please try again."
                        : undefined
                    }
                  />
                  <Textarea
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this group about?"
                    counter={`${description.length}/300`}
                    maxLength={300}
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      disabled={!isDirty || updateGroup.isPending || avatarUploading}
                      onClick={() => void handleSaveProfile()}
                    >
                      {(updateGroup.isPending || avatarUploading) ? (
                        <Spinner className="text-white" />
                      ) : (
                        'Save changes'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Members tab ── */}
          {tab === 'members' && (
            <div className="flex flex-col gap-2">
              <Input
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
                placeholder="Filter members…"
                aria-label="Filter members"
              />
              {membersLoading ? (
                <ul className="flex flex-col gap-0.5">
                  {[1, 2, 3].map((i) => (
                    <li key={i}>
                      <Skeleton className="h-10 w-full rounded-card" />
                    </li>
                  ))}
                </ul>
              ) : filteredMembers.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">
                  No members match.
                </p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {filteredMembers.map((m) => (
                    <li key={m.user.id}>
                      <MemberRow
                        member={m}
                        manageable
                        onPromote={() =>
                          changeRole.mutate({ userId: m.user.id, role: 'admin' })
                        }
                        onDemote={() =>
                          changeRole.mutate({ userId: m.user.id, role: 'member' })
                        }
                        onRemove={() =>
                          setConfirm({ removeMemberId: m.user.id })
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ── Danger zone tab ── */}
          {tab === 'danger' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 rounded-card border border-bg-active p-3">
                <div>
                  <p className="text-sm font-medium text-text-normal">
                    Leave group
                  </p>
                  <p className="text-xs text-text-muted">
                    You'll need a new invite to rejoin.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setConfirm('leave')}
                  disabled={leaveGroup.isPending}
                >
                  Leave
                </Button>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-card border border-danger/40 p-3">
                <div>
                  <p className="text-sm font-medium text-text-normal">
                    Delete group
                  </p>
                  <p className="text-xs text-text-muted">
                    Permanently removes the group for everyone.
                  </p>
                </div>
                <Button
                  variant="danger"
                  onClick={() => setConfirm('delete')}
                  disabled={deleteGroup.isPending}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm dialogs (rendered outside the scrollable area) */}
      <ConfirmDialog
        open={confirm === 'leave'}
        title="Leave group"
        message={`Leave ${displayName}? You'll need an invite to rejoin.`}
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          leaveGroup.mutate(undefined, { onSuccess: onClose });
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete group"
        message={`Permanently delete ${displayName}? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteGroup.mutate(undefined, { onSuccess: onClose });
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={
          confirm !== null &&
          confirm !== 'leave' &&
          confirm !== 'delete'
        }
        title="Remove member"
        message="Remove this member from the group?"
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (confirm && typeof confirm === 'object') {
            removeMember.mutate(confirm.removeMemberId);
          }
          setConfirm(null);
        }}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
