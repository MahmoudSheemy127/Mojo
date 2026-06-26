

// Socket Event types
import { PresenceStatus } from "@events/app-events";
import { ConversationView, MessageView } from "./conversation-view";
import { NotificationView } from "./notification-view";
import { GroupMemberView, GroupView } from "./group-view";



// Client to Server Events
export interface ClientToServerEvents {

    'typing:start': (data: { conversationId: string }) => void;

    'typing:stop': (data: { conversationId: string }) => void;

    'message:read': (data: { conversationId: string; lastReadMessageId: string }) => void;

}


// Server to Client Events
export interface ServerToClientEvents {

    // asyncapi.yaml#MessageNew — payload carries the serialized contract Message.
    'message:new': (data: { message: MessageView }) => void;

    'message:deleted': (data: { conversationId: string; messageId: string }) => void;

    'message:status': (data: { conversationId: string; userId: string; messageId: string; status: 'delivered' | 'read' }) => void;

    'typing:start': (data: { conversationId: string; userId: string }) => void;

    'typing:stop': (data: { conversationId: string; userId: string }) => void;

    'presence:changed': (data: { userId: string; status: PresenceStatus }) => void;

    // asyncapi.yaml#NotificationNew — payload carries the serialized contract Notification.
    'notification:new': (data: { notification: NotificationView }) => void;

    'conversation:new': (data: { conversation: ConversationView }) => void;

    'group:updated': (data: { group: GroupView }) => void;

    'group:deleted': (data: { groupId: string }) => void;

    'member:added': (data: { groupId: string; member: GroupMemberView }) => void;

    'member:removed': (data: { groupId: string; userId: string }) => void;

    'member:role_changed': (data: { groupId: string; userId: string; role: 'admin' | 'member' }) => void;

}