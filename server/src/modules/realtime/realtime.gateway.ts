import { WsJwtGuard } from "@common/guards/ws-jwt.guard";
import { ClientToServerEvents, ServerToClientEvents } from "@common/types/socket-events";
import { PresenceService } from "@modules/presence/presence.service";
import { UseGuards } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";


@WebSocketGateway({ cors: { origin: process.env.WEB_ORIGIN, credentials: true } })
@UseGuards(WsJwtGuard)
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {


    constructor(
        private readonly presenceService: PresenceService,
        private readonly jwtService: JwtService,
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
                next();
            } catch {
                next(new Error('UNAUTHENTICATED'));
            }
        });
    }

    async handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
        const id = socket.data.user.id;
        await socket.join(`user:${id}`);
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
        socket.to(`conversation:${data.conversationId}`).emit('typing:start', { conversationId: data.conversationId, userId });
    }

    @SubscribeMessage('typing:stop')
    handleTypingStop(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { conversationId: string }) {
        const userId = socket.data.user.id;
        socket.to(`conversation:${data.conversationId}`).emit('typing:stop', { conversationId: data.conversationId, userId });
    }

    @SubscribeMessage('message:read')
    handleMessageRead(socket: Socket<ClientToServerEvents, ServerToClientEvents>, data: { conversationId: string; lastReadMessageId: string }) {
        const userId = socket.data.user.id;
        socket.to(`conversation:${data.conversationId}`).emit('message:status', { conversationId: data.conversationId, userId, messageId: data.lastReadMessageId, status: 'read' });
    }


}