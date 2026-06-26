// src/common/types/notification-view.ts
// Serialized, contract-shaped view for the Notifications domain (docs/contract/
// _common.yaml#Notification + notifications.openapi.yaml). Kept in `common` so both the
// service that produces them (NotificationsService) and the realtime layer that broadcasts
// them (`notification:new`) share the type without a module → module dependency.
import { PublicUserView } from './conversation-view';

/** Contract NotificationType (docs/contract/_common.yaml#NotificationType). */
export type NotificationTypeView =
  | 'friend_request'
  | 'friend_request_accepted'
  | 'group_invite'
  | 'group_join_request'
  | 'mention'
  | 'missed_call'
  | 'generic';

/** NotificationPayload — ids let the FE dispatch to the right action endpoint. */
export interface NotificationPayloadView {
  requestId?: string;
  inviteId?: string;
  groupId?: string;
  conversationId?: string;
  messageId?: string;
  text?: string;
}

/** Notification (docs/contract/_common.yaml#Notification). */
export interface NotificationView {
  id: string;
  type: NotificationTypeView;
  actor: PublicUserView | null;
  read: boolean;
  createdAt: string;
  payload: NotificationPayloadView;
}
