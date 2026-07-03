import { WsJwtGuard } from "@common/guards/ws-jwt.guard";
import { ClientToServerEvents, ServerToClientEvents } from "@common/types/socket-events";
import { ConversationsService } from "@modules/conversations/conversations.service";
import { PresenceService } from "@modules/presence/presence.service";
import { Logger, UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";


@WebSocketGateway({ cors: { origin: 'http://localhost:5173', credentials: true } })
// @UseGuards(WsJwtGuard)
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {


    private readonly logger = new Logger(RealtimeGateway.name);

    constructor(
        private readonly presenceService: PresenceService,
        private readonly jwtService: JwtService,
        private readonly conversations: ConversationsService,
    ) {
    }

    @WebSocketServer()
    server!: Server<ClientToServerEvents, ServerToClientEvents>;

    // @UseGuards does not fire for handleConnection — Socket.io calls it before the NestJS
    // pipeline runs. We register a Socket.io middleware here so auth happens at the protocol
    // level, before handleConnection is ever invoked.
    afterInit(server: Server) {
        server.use((socket, next) => {
            try {
                const token = socket.handshake.auth.token ?? socket.handshake.query['token'];
                const payload = this.jwtService.verify(token as string, { secret: process.env.JWT_ACCESS_SECRET });
                socket.data.user = { id: payload.sub };
                console.log("Valid token");
                next();
            } catch {
                next(new Error('UNAUTHENTICATED'));
            }
        });
    }

    async handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
        const id = socket.data.user.id;
        await socket.join(`user:${id}`);
        // Join every conversation room the user belongs to so persist-then-broadcast emits
        // (message:new / message:deleted / message:status) reach them (asyncapi.yaml).
        const conversationIds = await this.conversations.listConversationIds(id);
        await Promise.all(conversationIds.map(async (cid) => socket.join(`conversation:${cid}`)));
        await this.presenceService.increment(id);
    }
    

    /* Handle disconnection */
    async handleDisconnect(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
        const userId = socket.data.user?.id;
        if (!userId) return;
        await this.presenceService.decrement(userId);
    }

    @SubscribeMessage('typing:start')
    handleTypingStart(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { conversationId: string }) {
        const userId = socket.data.user.id;
        console.log("Received Typing server");
        socket.to(`conversation:${data.conversationId}`).emit('typing:start', { conversationId: data.conversationId, userId });
    }

    @SubscribeMessage('typing:stop')
    handleTypingStop(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { conversationId: string }) {
        const userId = socket.data.user.id;
        socket.to(`conversation:${data.conversationId}`).emit('typing:stop', { conversationId: data.conversationId, userId });
    }

    // Persist-then-broadcast (NF-16): the durable read marker is written first, and
    // ConversationsService emits `message.read` after commit — RealtimeListener turns that
    // into the `message:status` broadcast. We never emit the receipt before the row is safe.
    @SubscribeMessage('message:read')
    async handleMessageRead(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { conversationId: string; lastReadMessageId: string }) {
        const userId = socket.data.user.id;
        try {
            await this.conversations.markRead(userId, data.conversationId, data.lastReadMessageId);
        } catch (err) {
            this.logger.warn(`message:read ignored for ${userId}/${data.conversationId}: ${String(err)}`);
        }
    }


}