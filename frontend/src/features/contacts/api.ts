// src/features/contacts/api.ts
import { api } from '@/lib/axios';
import type {
  FriendsListResponse,
  ContactRequestsResponse,
  SendFriendRequestResponse,
  AcceptFriendRequestResponse,
  BlockUserResponse,
  UserSearchResponse,
} from '@/types/api';

/** GET /contacts — paginated friends list with live-ish presence (FR-06). */
export async function fetchFriends(cursor?: string): Promise<FriendsListResponse> {
  const { data } = await api.get<FriendsListResponse>('/contacts', {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}

/** GET /contacts/requests — incoming and outgoing pending requests (FR-06). */
export async function fetchContactRequests(): Promise<ContactRequestsResponse> {
  const { data } = await api.get<ContactRequestsResponse>('/contacts/requests');
  return data;
}

/** POST /contacts/requests — send a friend request (FR-06). */
export async function sendFriendRequest(
  userId: string,
): Promise<SendFriendRequestResponse> {
  const { data } = await api.post<SendFriendRequestResponse>(
    '/contacts/requests',
    { userId },
  );
  return data;
}

/** POST /contacts/requests/:requestId/accept — accept a request (FR-06). */
export async function acceptFriendRequest(
  requestId: string,
): Promise<AcceptFriendRequestResponse> {
  const { data } = await api.post<AcceptFriendRequestResponse>(
    `/contacts/requests/${requestId}/accept`,
  );
  return data;
}

/** POST /contacts/requests/:requestId/decline — decline a request (FR-06). */
export async function declineFriendRequest(requestId: string): Promise<void> {
  await api.post(`/contacts/requests/${requestId}/decline`);
}

/** DELETE /contacts/:userId — remove a contact symmetrically (FR-07). */
export async function removeFriend(userId: string): Promise<void> {
  await api.delete(`/contacts/${userId}`);
}

/** POST /contacts/blocks — block a user (FR-08). */
export async function blockUser(userId: string): Promise<BlockUserResponse> {
  const { data } = await api.post<BlockUserResponse>('/contacts/blocks', {
    userId,
  });
  return data;
}

/** GET /users/search — global user search with per-row relationship (FR-05). */
export async function searchUsers(
  q: string,
  cursor?: string,
): Promise<UserSearchResponse> {
  const { data } = await api.get<UserSearchResponse>('/users/search', {
    params: { q, ...(cursor ? { cursor } : {}) },
  });
  return data;
}
