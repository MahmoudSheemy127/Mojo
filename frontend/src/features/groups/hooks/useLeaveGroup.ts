// src/features/groups/hooks/useLeaveGroup.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import { conversationsKey } from '@/features/contacts/hooks/useConversations';
import { removeGroupMember } from '../api';
import { groupKey } from './useGroupSettings';

/**
 * Mutation: leave a group (FR-22).
 * Calls DELETE /groups/:groupId/members/:selfId, invalidates the conversation
 * list, removes the group from cache, navigates home, and shows a toast.
 */
export function useLeaveGroup(groupId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const currentUserId = useAuthStore((s) => s.currentUser?.id);

  return useMutation<void, Error, void>({
    mutationFn: () => {
      if (!currentUserId) throw new Error('Not authenticated');
      return removeGroupMember(groupId, currentUserId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...conversationsKey] });
      queryClient.removeQueries({ queryKey: groupKey(groupId) });
      toast.info('You left the group.');
      void navigate('/c');
    },
    onError: () => toast.error("Couldn't leave the group. Please try again."),
  });
}
