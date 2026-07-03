// src/features/groups/api.ts
import { api } from '@/lib/axios';
import type {
  Group,
  CreateGroupRequest,
  UpdateGroupRequest,
  ListGroupMembersResponse,
  AddGroupMembersResponse,
  ApiGroupMember,
  CreateInviteLinkResponse,
  GroupAvatarUploadResponse,
  AcceptGroupInviteResponse,
} from '@/types/api';

/** POST /groups — create a group and become its admin (FR-18). */
export async function createGroup(payload: CreateGroupRequest): Promise<Group> {
  const { data } = await api.post<Group>('/groups', payload);
  return data;
}

/** GET /groups/:groupId — group detail with members populated. */
export async function fetchGroup(groupId: string): Promise<Group> {
  const { data } = await api.get<Group>(`/groups/${groupId}`);
  return data;
}

/** PATCH /groups/:groupId — update group profile (name, description, avatar). Admin only (FR-23). */
export async function updateGroup(
  groupId: string,
  payload: UpdateGroupRequest,
): Promise<Group> {
  const { data } = await api.patch<Group>(`/groups/${groupId}`, payload);
  return data;
}

/** DELETE /groups/:groupId — delete the group for all members. Admin only. */
export async function deleteGroup(groupId: string): Promise<void> {
  await api.delete(`/groups/${groupId}`);
}

/** GET /groups/:groupId/members — paginated member list. */
export async function listGroupMembers(
  groupId: string,
  cursor?: string,
): Promise<ListGroupMembersResponse> {
  const { data } = await api.get<ListGroupMembersResponse>(
    `/groups/${groupId}/members`,
    { params: cursor ? { cursor } : undefined },
  );
  return data;
}

/** POST /groups/:groupId/members — add or invite members (FR-19). Admin or per policy. */
export async function addGroupMembers(
  groupId: string,
  userIds: string[],
): Promise<AddGroupMembersResponse> {
  const { data } = await api.post<AddGroupMembersResponse>(
    `/groups/${groupId}/members`,
    { userIds },
  );
  return data;
}

/** PATCH /groups/:groupId/members/:userId — promote or demote a member (FR-20). Admin only. */
export async function changeMemberRole(
  groupId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<ApiGroupMember> {
  const { data } = await api.patch<ApiGroupMember>(
    `/groups/${groupId}/members/${userId}`,
    { role },
  );
  return data;
}

/** DELETE /groups/:groupId/members/:userId — remove a member (FR-21) or leave (FR-22). */
export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/groups/${groupId}/members/${userId}`);
}

/** PUT /groups/:groupId/avatar — upload a group avatar (FR-23). Admin only. */
export async function uploadGroupAvatar(
  groupId: string,
  file: File,
): Promise<GroupAvatarUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.put<GroupAvatarUploadResponse>(
    `/groups/${groupId}/avatar`,
    form,
  );
  return data;
}

/** DELETE /groups/:groupId/avatar — remove the group avatar (FR-23). Admin only. */
export async function deleteGroupAvatar(groupId: string): Promise<void> {
  await api.delete(`/groups/${groupId}/avatar`);
}

/** POST /groups/:groupId/invite-link — generate a shareable invite link (FR-19). */
export async function generateInviteLink(
  groupId: string,
): Promise<CreateInviteLinkResponse> {
  const { data } = await api.post<CreateInviteLinkResponse>(
    `/groups/${groupId}/invite-link`,
  );
  return data;
}

/** POST /groups/:groupId/invites/:inviteId/accept — accept a group invite (FR-19). */
export async function acceptGroupInvite(
  groupId: string,
  inviteId: string,
): Promise<AcceptGroupInviteResponse> {
  const { data } = await api.post<AcceptGroupInviteResponse>(
    `/groups/${groupId}/invites/${inviteId}/accept`,
  );
  return data;
}

/** POST /groups/:groupId/invites/:inviteId/decline — decline a group invite (FR-19). */
export async function declineGroupInvite(
  groupId: string,
  inviteId: string,
): Promise<void> {
  await api.post(`/groups/${groupId}/invites/${inviteId}/decline`);
}

/** POST /groups/:groupId/join-requests/:requestId/accept — admin approves a join request (FR-19). */
export async function acceptJoinRequest(
  groupId: string,
  requestId: string,
): Promise<ApiGroupMember> {
  const { data } = await api.post<{ member: ApiGroupMember }>(
    `/groups/${groupId}/join-requests/${requestId}/accept`,
  );
  return data.member;
}

/** POST /groups/:groupId/join-requests/:requestId/decline — admin denies a join request (FR-19). */
export async function declineJoinRequest(
  groupId: string,
  requestId: string,
): Promise<void> {
  await api.post(`/groups/${groupId}/join-requests/${requestId}/decline`);
}
