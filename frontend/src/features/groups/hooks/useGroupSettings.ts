// src/features/groups/hooks/useGroupSettings.ts
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { useAuthStore } from '@/store/authStore';
import { useToast } from '@/hooks/useToast';
import type { Group, ApiGroupMember, UpdateGroupRequest } from '@/types/api';
import {
  fetchGroup,
  listGroupMembers,
  updateGroup,
  deleteGroup,
  changeMemberRole,
  removeGroupMember,
} from '../api';

export const groupKey = (groupId: string) => ['groups', groupId] as const;
export const groupMembersKey = (groupId: string) =>
  ['groups', groupId, 'members'] as const;

// ── Socket subscriptions (Stage 6) ─────────────────────────────────────────

/**
 * Subscribes to group-scoped socket events for the given conversation.
 * `group:updated` → invalidates the group query so the UI reflects the change.
 * `member:removed` → if the current user was removed, navigates home and toasts.
 * `member:role_changed` → updates members cache; calls `onDemoted` if the current
 *   user lost admin while the settings modal is open.
 * `group:deleted` → navigates home and toasts when the group is deleted.
 * `member:added` → invalidates members cache so the list refreshes live.
 */
export function useGroupSettings(
  groupId: string,
  { onDemoted }: { onDemoted?: () => void } = {},
) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.currentUser?.id);
  const navigate = useNavigate();
  const { info } = useToast();

  const onGroupUpdated = useCallback(
    (payload: { group: unknown }) => {
      const g = payload.group as { id?: string } | null;
      if (!g || g.id !== groupId) return;
      void queryClient.invalidateQueries({ queryKey: groupKey(groupId) });
    },
    [groupId, queryClient],
  );
  useSocketEvent('group:updated', onGroupUpdated);

  const onMemberRemoved = useCallback(
    (payload: { groupId: string; userId: string }) => {
      if (payload.groupId !== groupId) return;
      void queryClient.invalidateQueries({
        queryKey: groupMembersKey(groupId),
      });
      if (payload.userId === currentUserId) {
        info('You were removed from the group.');
        void navigate('/c');
      }
    },
    [groupId, currentUserId, queryClient, navigate, info],
  );
  useSocketEvent('member:removed', onMemberRemoved);

  const onMemberRoleChanged = useCallback(
    (payload: { groupId: string; userId: string; role: string }) => {
      if (payload.groupId !== groupId) return;
      queryClient.setQueryData<ApiGroupMember[]>(
        groupMembersKey(groupId),
        (old) =>
          old?.map((m) =>
            m.user.id === payload.userId
              ? { ...m, role: payload.role as 'admin' | 'member' }
              : m,
          ) ?? [],
      );
      if (payload.userId === currentUserId && payload.role === 'member') {
        onDemoted?.();
      }
    },
    [groupId, currentUserId, queryClient, onDemoted],
  );
  useSocketEvent('member:role_changed', onMemberRoleChanged);

  const onGroupDeleted = useCallback(
    (payload: { groupId: string }) => {
      if (payload.groupId !== groupId) return;
      info('This group has been deleted.');
      void navigate('/c');
    },
    [groupId, navigate, info],
  );
  useSocketEvent('group:deleted', onGroupDeleted);

  const onMemberAdded = useCallback(
    (payload: { groupId: string; member: unknown }) => {
      if (payload.groupId !== groupId) return;
      void queryClient.invalidateQueries({
        queryKey: groupMembersKey(groupId),
      });
    },
    [groupId, queryClient],
  );
  useSocketEvent('member:added', onMemberAdded);
}

// ── REST queries (Stage 7) ──────────────────────────────────────────────────

/** Query: group detail with members populated. Keys on `['groups', groupId]`. */
export function useGroup(groupId: string) {
  return useQuery<Group>({
    queryKey: groupKey(groupId),
    queryFn: () => fetchGroup(groupId),
    enabled: Boolean(groupId),
  });
}

/** Query: paginated member list. Keys on `['groups', groupId, 'members']`. */
export function useGroupMembers(groupId: string) {
  return useQuery<ApiGroupMember[]>({
    queryKey: groupMembersKey(groupId),
    queryFn: async () => {
      const res = await listGroupMembers(groupId);
      return res.data;
    },
    enabled: Boolean(groupId),
  });
}

// ── REST mutations (Stage 7) ────────────────────────────────────────────────

/** Mutation: update group name, description, and/or avatar (FR-23). */
export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<Group, Error, UpdateGroupRequest>({
    mutationFn: (payload) => updateGroup(groupId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<Group>(groupKey(groupId), updated);
      toast.success('Group profile saved.');
    },
    onError: () => toast.error("Couldn't save group profile. Please try again."),
  });
}

/** Mutation: delete the group entirely (admin only). */
export function useDeleteGroup(groupId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();

  return useMutation<void, Error, void>({
    mutationFn: () => deleteGroup(groupId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.removeQueries({ queryKey: groupKey(groupId) });
      toast.info('Group deleted.');
      void navigate('/c');
    },
    onError: () => toast.error("Couldn't delete the group. Please try again."),
  });
}

/** Mutation: promote or demote a member (FR-20). Optimistic role update with rollback. */
export function useChangeMemberRole(groupId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<
    ApiGroupMember,
    Error,
    { userId: string; role: 'admin' | 'member' }
  >({
    mutationFn: ({ userId, role }) => changeMemberRole(groupId, userId, role),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: groupMembersKey(groupId) });
      const previous = queryClient.getQueryData<ApiGroupMember[]>(
        groupMembersKey(groupId),
      );
      queryClient.setQueryData<ApiGroupMember[]>(
        groupMembersKey(groupId),
        (old) =>
          old?.map((m) => (m.user.id === userId ? { ...m, role } : m)) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      const context = ctx as { previous?: ApiGroupMember[] } | undefined;
      if (context?.previous) {
        queryClient.setQueryData(groupMembersKey(groupId), context.previous);
      }
      toast.error("Couldn't change role. Please try again.");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: groupMembersKey(groupId) });
    },
  });
}

/** Mutation: remove a member from the group (FR-21). Admin only. */
export function useRemoveMember(groupId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation<void, Error, string>({
    mutationFn: (userId) => removeGroupMember(groupId, userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<ApiGroupMember[]>(
        groupMembersKey(groupId),
        (old) => old?.filter((m) => m.user.id !== userId) ?? [],
      );
      toast.success('Member removed.');
    },
    onError: () => toast.error("Couldn't remove member. Please try again."),
  });
}
