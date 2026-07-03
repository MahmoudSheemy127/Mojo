// src/common/guards/ws-jwt.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';



/**
 * WebSocket auth guard. Reads the JWT from socket.handshake.auth.token,
 * verifies it, and attaches { id } to socket.data.user. Rejects with
 * WsException('UNAUTHENTICATED') on failure.
 */


@Injectable()
export class WsJwtGuard implements CanActivate {

    constructor(private readonly jwtService: JwtService) {
    }

    canActivate(context: ExecutionContext) {
        
        const socket = context.switchToWs().getClient();

        /* Get token */
        const token = socket.handshake.query.token;

        console.log("Tokennnnn ", token)
        
        /* Call JWT Service (Validate token) */
        try{

            /* Verify token */
            const payload = this.jwtService.verify(token, {secret: process.env.JWT_ACCESS_SECRET})
    
            console.log("Data ", payload)
            /* Update the socket metadata */
            socket.data.user = { id: payload.sub };
    
            return true;

        } catch {
            throw new WsException('UNAUTHENTICATED');
        }
    }



}
