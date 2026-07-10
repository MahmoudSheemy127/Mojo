// src/common/types/conversation-view.ts
// Serialized, contract-shaped views for the Conversations domain (docs/contract/
// _common.yaml + conversations.openapi.yaml). Kept in `common` so both the service that
// produces them and the realtime layer that broadcasts them (conversation:new) can share
// the types without a module → module dependency.
import { PresenceStatus } from '../../events/app-events';

/** PublicUser (docs/contract/_common.yaml#PublicUser). */
export interface PublicUserView {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  presence: PresenceStatus;
}

/** Attachment (docs/contract/_common.yaml#Attachment). */
export interface AttachmentView {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'file';
}

/** Message (docs/contract/_common.yaml#Message), used as a conversation's lastMessage. */
export interface MessageView {
  id: string;
  conversationId: string;
  sequence: number;
  senderId: string;
  content: string | null;
  attachments: AttachmentView[];
  status: 'sent' | 'delivered' | 'read';
  createdAt: string;
  deletedAt: string | null;
}

interface ConversationBaseView {
  id: string;
  lastMessage: MessageView | null;
  lastActivityAt: string;
  unreadCount: number;
}

/** DmConversation (docs/contract/_common.yaml#DmConversation). */
export interface DmConversationView extends ConversationBaseView {
  type: 'dm';
  otherUser: PublicUserView;
}

/** GroupConversation (docs/contract/_common.yaml#GroupConversation). */
export interface GroupConversationView extends ConversationBaseView {
  type: 'group';
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  members: PublicUserView[];
  role: 'admin' | 'member';
}

/** Discriminated union over `type` (docs/contract/_common.yaml#Conversation). */
export type ConversationView = DmConversationView | GroupConversationView;

/** Keyset page envelope (Paginated<T>) shared by the list endpoints. */
export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}
