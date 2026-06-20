

// Socket Event types
import { Conversation, Group, GroupRole, Member, Message, Notification } from "@prisma/client";
import { PresenceStatus } from "@events/app-events";



// Client to Server Events
export interface ClientToServerEvents {

    'typing:start': (data: { conversationId: string }) => void;

    'typing:stop': (data: { conversationId: string }) => void;

    'message:read': (data: { conversationId: string; lastReadMessageId: string }) => void;

}


// Server to Client Events
export interface ServerToClientEvents {

    'message:new': (data: { conversationId: string; message: Message }) => void;

    'message:deleted': (data: { conversationId: string; messageId: string }) => void;

    'message:status': (data: { conversationId: string; userId: string; messageId: string; status: 'delivered' | 'read' }) => void;

    'typing:start': (data: { conversationId: string; userId: string }) => void;

    'typing:stop': (data: { conversationId: string; userId: string }) => void;

    'presence:changed': (data: { userId: string; status: PresenceStatus }) => void;

    'notification:new': (data: { notification: Notification }) => void;

    'conversation:new': (data: { conversation: Conversation }) => void;

    'group:updated': (data: { group: Group }) => void;

    'group:deleted': (data: { groupId: string }) => void;

    'member:added': (data: { groupId: string; member: Member }) => void;

    'member:removed': (data: { groupId: string; userId: string }) => void;

    'member:role_changed': (data: { groupId: string; userId: string; role: GroupRole }) => void;

}