// src/common/types/group-view.ts
// Serialized, contract-shaped views for the Groups domain (docs/contract/_common.yaml#Group
// + #GroupMember). Kept in `common` so both GroupsService (REST responses) and the realtime
// layer (group:updated / member:added broadcasts) share the exact same shapes without a
// module → module dependency.
import { PublicUserView } from './conversation-view';

/** GroupMember (docs/contract/_common.yaml#GroupMember). */
export interface GroupMemberView {
  user: PublicUserView;
  role: 'admin' | 'member';
  joinedAt: string;
}

/**
 * Group (docs/contract/_common.yaml#Group). `role` is the *viewer's* role in the group, so a
 * GroupView is always built for a specific caller. `members` is populated only on the detail
 * endpoint (GET /groups/:id).
 */
export interface GroupView {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  createdAt: string;
  memberCount: number;
  role: 'admin' | 'member';
  members?: GroupMemberView[];
}
