import {
  AppEvent,
  ConversationCreatedPayload,
  GroupDeletedPayload,
  GroupUpdatedPayload,
  MemberAddedPayload,
  MemberRemovedPayload,
  MemberRoleChangedPayload,
  MessageCreatedPayload,
  MessageDeletedPayload,
  MessageReadPayload,
  NotificationCreatedPayload,
  PresenceChangedPayload,
} from "@events/app-events";
import { OnEvent } from "@nestjs/event-emitter";
import { Injectable, Logger } from "@nestjs/common";
import { ConversationsService } from "@modules/conversations/conversations.service";
import { GroupsService } from "@modules/groups/groups.service";
import { RealtimeGateway } from "./realtime.gateway";


@Injectable()
export class RealtimeListener {
    private readonly logger = new Logger(RealtimeListener.name);

    constructor(
        private readonly gateway: RealtimeGateway,
        private readonly conversations: ConversationsService,
        private readonly groups: GroupsService,
    ) {}



    @OnEvent(AppEvent.PresenceChanged)
    handlePresenceChanged(payload: PresenceChangedPayload) {
        // TODO: replace with per-contact fan-out when ContactsModule is implemented
        this.gateway.server.emit('presence:changed', payload);
    }

    /**
     * `conversation.created` → `conversation:new`. The conversation view is per-viewer
     * (DMs carry the *other* user), so we resolve each recipient's own view from the
     * already-committed row and push it to their `user:<id>` room.
     */
    @OnEvent(AppEvent.ConversationCreated)
    async handleConversationCreated(payload: ConversationCreatedPayload) {
        for (const recipientId of payload.recipientIds) {
            try {
                const conversation = await this.conversations.getOne(recipientId, payload.conversationId);
                this.gateway.server.to(`user:${recipientId}`).emit('conversation:new', { conversation });
            } catch (err) {
                this.logger.warn(`conversation:new fan-out skipped for ${recipientId}: ${String(err)}`);
            }
        }
    }

    /**
     * `notification.created` → `notification:new`. The row is already committed
     * (persist-then-broadcast, NF-16); push the serialized notification to the recipient's
     * `user:<id>` room so the bell badge updates live (asyncapi.yaml#NotificationNew).
     */
    @OnEvent(AppEvent.NotificationCreated)
    handleNotificationCreated(payload: NotificationCreatedPayload) {
        this.gateway.server
            .to(`user:${payload.recipientId}`)
            .emit('notification:new', { notification: payload.notification });
    }

    /**
     * `message.created` → `message:new`. The row is already committed (persist-then-broadcast,
     * NF-16); fan the serialized message out to the conversation room so every participant
     * (incl. the sender's other devices) receives it live (asyncapi.yaml#MessageNew).
     */
    @OnEvent(AppEvent.MessageCreated)
    handleMessageCreated(payload: MessageCreatedPayload) {
        this.gateway.server
            .to(`conversation:${payload.conversationId}`)
            .emit('message:new', { message: payload.message });
    }

    /**
     * `message.deleted` → `message:deleted`. The soft-delete is committed; tell the room to
     * swap the bubble for the "deleted" placeholder (FR-16, asyncapi.yaml#MessageDeleted).
     */
    @OnEvent(AppEvent.MessageDeleted)
    handleMessageDeleted(payload: MessageDeletedPayload) {
        this.gateway.server.to(`conversation:${payload.conversationId}`).emit('message:deleted', {
            conversationId: payload.conversationId,
            messageId: payload.messageId,
        });
    }

    /**
     * `message.read` → `message:status` (read receipt). The read marker is already
     * persisted; broadcast to the conversation room so senders' UIs show "Read" (FR-14).
     */
    @OnEvent(AppEvent.MessageRead)
    handleMessageRead(payload: MessageReadPayload) {
        this.gateway.server.to(`conversation:${payload.conversationId}`).emit('message:status', {
            conversationId: payload.conversationId,
            messageId: payload.lastReadMessageId,
            status: 'read',
            userId: payload.userId,
        });
    }

    /**
     * `group.updated` → `group:updated`. The contract Group carries the *viewer's* role, so
     * (like conversation:new) we resolve each member's own view from the committed row and push
     * it to their `user:<id>` room (asyncapi.yaml#GroupUpdated).
     */
    @OnEvent(AppEvent.GroupUpdated)
    async handleGroupUpdated(payload: GroupUpdatedPayload) {
        for (const recipientId of payload.recipientIds) {
            try {
                const group = await this.groups.getOne(recipientId, payload.groupId);
                this.gateway.server.to(`user:${recipientId}`).emit('group:updated', { group });
            } catch (err) {
                this.logger.warn(`group:updated fan-out skipped for ${recipientId}: ${String(err)}`);
            }
        }
    }

    /**
     * `group.deleted` → `group:deleted`. Group id == conversation id, so members are already
     * in the `conversation:<id>` room; broadcast there (asyncapi.yaml#GroupDeleted).
     */
    @OnEvent(AppEvent.GroupDeleted)
    handleGroupDeleted(payload: GroupDeletedPayload) {
        this.gateway.server
            .to(`conversation:${payload.groupId}`)
            .emit('group:deleted', { groupId: payload.groupId });
    }

    /** `member.added` → `member:added` to the group's `conversation:<id>` room. */
    @OnEvent(AppEvent.MemberAdded)
    handleMemberAdded(payload: MemberAddedPayload) {
        this.gateway.server
            .to(`conversation:${payload.groupId}`)
            .emit('member:added', { groupId: payload.groupId, member: payload.member });
    }

    /** `member.removed` → `member:removed` to the group's `conversation:<id>` room. */
    @OnEvent(AppEvent.MemberRemoved)
    handleMemberRemoved(payload: MemberRemovedPayload) {
        this.gateway.server
            .to(`conversation:${payload.groupId}`)
            .emit('member:removed', { groupId: payload.groupId, userId: payload.userId });
    }

    /** `member.role_changed` → `member:role_changed` to the group's `conversation:<id>` room. */
    @OnEvent(AppEvent.MemberRoleChanged)
    handleMemberRoleChanged(payload: MemberRoleChangedPayload) {
        this.gateway.server.to(`conversation:${payload.groupId}`).emit('member:role_changed', {
            groupId: payload.groupId,
            userId: payload.userId,
            role: payload.role,
        });
    }
}
