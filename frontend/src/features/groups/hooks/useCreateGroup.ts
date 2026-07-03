// src/features/groups/hooks/useCreateGroup.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import type { Group, CreateGroupRequest } from '@/types/api';
import { conversationsKey } from '@/features/contacts/hooks/useConversations';
import { createGroup } from '../api';

/**
 * Mutation: create a new group (FR-18).
 * On success, invalidates conversations, navigates to the new group chat,
 * and shows a success toast.
 */
export function useCreateGroup() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  return useMutation<Group, Error, CreateGroupRequest>({
    mutationFn: createGroup,
    onSuccess: (group) => {
      void queryClient.invalidateQueries({ queryKey: [...conversationsKey] });
      toast.success('Group created!');
      void navigate(`/c/${group.id}`);
    },
    onError: () => toast.error("Couldn't create group. Please try again."),
  });
}
