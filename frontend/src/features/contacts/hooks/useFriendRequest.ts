// src/features/contacts/hooks/useFriendRequest.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
} from '../api';
import { friendsKey } from './useContacts';

/** Mutation: send a friend request (FR-06). Invalidates the friends list on success. */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (userId: string) => sendFriendRequest(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendsKey });
      toast.success('Friend request sent!');
    },
    onError: () => toast.error("Couldn't send friend request. Please try again."),
  });
}

/** Mutation: accept a pending friend request (FR-06). */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (requestId: string) => acceptFriendRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: friendsKey });
      toast.success('Friend request accepted!');
    },
    onError: () =>
      toast.error("Couldn't accept the request. Please try again."),
  });
}

/** Mutation: decline a pending friend request (FR-06). */
export function useDeclineFriendRequest() {
  const toast = useToast();

  return useMutation({
    mutationFn: (requestId: string) => declineFriendRequest(requestId),
    onError: () =>
      toast.error("Couldn't decline the request. Please try again."),
  });
}
