// src/features/notifications/hooks/useNotificationActions.ts
// Dispatches accept/decline for actionable notifications to the relevant
// contacts/groups endpoints by type, then removes the resolved row from the
// feed cache. Instantiate per row so `isPending` is isolated to that row.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import type { Notification } from '@/types/entities';
import {
  acceptFriendRequest,
  declineFriendRequest,
} from '@/features/contacts/api';
import {
  acceptGroupInvite,
  declineGroupInvite,
  acceptJoinRequest,
  declineJoinRequest,
} from '@/features/groups/api';
import { friendsKey } from '@/features/contacts/hooks/useContacts';
import { conversationsKey } from '@/features/contacts/hooks/useConversations';
import { groupMembersKey } from '@/features/groups/hooks/useGroupSettings';
import { notificationsKey } from './useNotifications';

interface FriendVars {
  requestId: string;
  notifId: string;
}
interface InviteVars {
  groupId: string;
  inviteId: string;
  notifId: string;
}
interface JoinVars {
  groupId: string;
  requestId: string;
  notifId: string;
}

/**
 * Mutations for the six actionable notification flows. Each resolves by removing
 * the notification row and invalidating the lists it affects, with a toast on
 * success/failure.
 */
export function useNotificationActions() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const removeRow = (notifId: string) => {
    queryClient.setQueryData<Notification[]>(
      notificationsKey,
      (old) => old?.filter((n) => n.id !== notifId) ?? [],
    );
  };

  return {
    // ── Friend request (FR-06) ──────────────────────────────────
    acceptFriendRequest: useMutation({
      mutationFn: ({ requestId }: FriendVars) => acceptFriendRequest(requestId),
      onSuccess: (_data, { notifId }) => {
        removeRow(notifId);
        void queryClient.invalidateQueries({ queryKey: friendsKey });
        void queryClient.invalidateQueries({ queryKey: conversationsKey });
        toast.success('Friend request accepted!');
      },
      onError: () => toast.error("Couldn't accept the request. Please try again."),
    }),
    declineFriendRequest: useMutation({
      mutationFn: ({ requestId }: FriendVars) => declineFriendRequest(requestId),
      onSuccess: (_data, { notifId }) => removeRow(notifId),
      onError: () =>
        toast.error("Couldn't decline the request. Please try again."),
    }),

    // ── Group invite (FR-19) ────────────────────────────────────
    acceptGroupInvite: useMutation({
      mutationFn: ({ groupId, inviteId }: InviteVars) =>
        acceptGroupInvite(groupId, inviteId),
      onSuccess: (_data, { notifId }) => {
        removeRow(notifId);
        void queryClient.invalidateQueries({ queryKey: conversationsKey });
        void queryClient.invalidateQueries({ queryKey: ['groups'] });
        toast.success('Joined the group!');
      },
      onError: () => toast.error("Couldn't accept the invite. Please try again."),
    }),
    declineGroupInvite: useMutation({
      mutationFn: ({ groupId, inviteId }: InviteVars) =>
        declineGroupInvite(groupId, inviteId),
      onSuccess: (_data, { notifId }) => removeRow(notifId),
      onError: () =>
        toast.error("Couldn't decline the invite. Please try again."),
    }),

    // ── Group join request — admin only (FR-19) ─────────────────
    acceptJoinRequest: useMutation({
      mutationFn: ({ groupId, requestId }: JoinVars) =>
        acceptJoinRequest(groupId, requestId),
      onSuccess: (_data, { groupId, notifId }) => {
        removeRow(notifId);
        void queryClient.invalidateQueries({
          queryKey: groupMembersKey(groupId),
        });
        toast.success('Request approved!');
      },
      onError: () =>
        toast.error("Couldn't approve the request. Please try again."),
    }),
    declineJoinRequest: useMutation({
      mutationFn: ({ groupId, requestId }: JoinVars) =>
        declineJoinRequest(groupId, requestId),
      onSuccess: (_data, { notifId }) => removeRow(notifId),
      onError: () =>
        toast.error("Couldn't decline the request. Please try again."),
    }),
  };
}
