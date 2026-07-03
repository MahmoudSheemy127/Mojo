// src/features/groups/components/InviteMembersModal.tsx
import { useEffect, useRef, useState } from 'react';
import type { AddGroupMembersResponse, PublicUser } from '@/types/api';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { useContacts } from '@/features/contacts/hooks/useContacts';
import { useGroupMembers } from '../hooks/useGroupSettings';
import { useInviteMembers } from '../hooks/useInviteMembers';
import { useOverlay } from '@/layouts/overlayContext';

interface InviteMembersModalProps {
  open: boolean;
  onClose: () => void;
  groupId: string;
  groupName?: string | undefined;
}

/** Invite members: friend picker + shareable invite link (FR-19). */
export function InviteMembersModal({
  open,
  onClose,
  groupId,
  groupName = 'this group',
}: InviteMembersModalProps) {
  const [selected, setSelected] = useState<PublicUser[]>([]);
  const [linkCopied, setLinkCopied] = useState(false);
  const invitedIdsRef = useRef<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<AddGroupMembersResponse | null>(null);

  const { data: friends = [] } = useContacts();
  const { data: existingMembers = [] } = useGroupMembers(groupId);
  const { invite, generateLink } = useInviteMembers(groupId);
  const { openModal } = useOverlay();

  const existingMemberIds = existingMembers.map((m) => m.user.id);

  // Fetch invite link when the modal opens
  useEffect(() => {
    if (open && !generateLink.data && !generateLink.isPending) {
      generateLink.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelected([]);
      setLinkCopied(false);
      setLastResult(null);
      invitedIdsRef.current = new Set();
    }
  }, [open]);

  function handleCopyLink() {
    const link = generateLink.data?.url;
    if (!link) return;
    void navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  function handleInvite() {
    if (selected.length === 0) return;
    invite.mutate(
      selected.map((u) => u.id),
      {
        onSuccess: (res) => {
          res.invited.forEach((u) => invitedIdsRef.current.add(u.id));
          setLastResult(res);
          setSelected([]);
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-label={`Invite to ${groupName}`}
    >
      <ModalHeader title={`Invite to ${groupName}`} onClose={onClose} />
      <div className="flex flex-col gap-4 p-4">
        {/* Per-row invite outcome (shown after a successful invite batch) */}
        {lastResult && (lastResult.added.length > 0 || lastResult.invited.length > 0) && (
          <div className="rounded-card border border-bg-active p-3 text-sm">
            {lastResult.added.map((m) => (
              <p key={m.user.id} className="text-success">
                {m.user.displayName} — Added
              </p>
            ))}
            {lastResult.invited.map((u) => (
              <p key={u.id} className="text-text-muted">
                {u.displayName} — Invite sent
              </p>
            ))}
          </div>
        )}
        {invite.isError && (
          <p role="alert" className="text-xs text-danger">
            Couldn't send invites. Please try again.
          </p>
        )}

        {/* Friend picker — already-members are excluded */}
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
            to invite them here.
          </p>
        ) : (
          <MemberPicker
            candidates={friends}
            value={selected}
            onChange={setSelected}
            excludeIds={existingMemberIds}
            invitedIds={[...invitedIdsRef.current]}
            placeholder="Search friends to invite…"
          />
        )}

        {/* Invite link section */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
            Or share an invite link
          </p>
          <div className="flex items-end gap-2">
            <Input
              label=""
              value={generateLink.data?.url ?? ''}
              readOnly
              placeholder={
                generateLink.isPending ? 'Generating link…' : 'Invite link'
              }
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={handleCopyLink}
              disabled={!generateLink.data?.url}
            >
              {linkCopied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          {generateLink.isError && (
            <p className="mt-1 text-xs text-danger">
              Couldn't generate link.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => generateLink.mutate()}
              >
                Retry
              </button>
            </p>
          )}
          <p className="mt-1 text-xs text-text-muted">
            Anyone with this link can request to join.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-bg-deepest px-4 py-3">
        <Button variant="ghost" onClick={onClose} disabled={invite.isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={selected.length === 0 || invite.isPending}
          onClick={handleInvite}
        >
          {invite.isPending ? (
            <Spinner className="text-white" />
          ) : (
            `Invite (${selected.length})`
          )}
        </Button>
      </div>
    </Modal>
  );
}
