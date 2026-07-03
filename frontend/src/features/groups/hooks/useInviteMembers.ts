// src/features/groups/hooks/useInviteMembers.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import type { AddGroupMembersResponse, CreateInviteLinkResponse } from '@/types/api';
import { addGroupMembers, generateInviteLink } from '../api';
import { groupMembersKey } from './useGroupSettings';

/**
 * Mutations for the Invite Members modal (FR-19):
 * - `invite` — send invites to a list of user ids.
 * - `generateLink` — generate a shareable invite link.
 */
export function useInviteMembers(groupId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const invite = useMutation<AddGroupMembersResponse, Error, string[]>({
    mutationFn: (userIds) => addGroupMembers(groupId, userIds),
    onSuccess: ({ added, invited }) => {
      void queryClient.invalidateQueries({ queryKey: groupMembersKey(groupId) });
      const count = added.length + invited.length;
      toast.success(`${count} member${count !== 1 ? 's' : ''} invited!`);
    },
    onError: () => toast.error("Couldn't send invites. Please try again."),
  });

  const generateLink = useMutation<CreateInviteLinkResponse, Error, void>({
    mutationFn: () => generateInviteLink(groupId),
    onError: () => toast.error("Couldn't generate invite link. Please try again."),
  });

  return { invite, generateLink };
}
