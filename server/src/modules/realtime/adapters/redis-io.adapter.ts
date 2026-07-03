import { IoAdapter } from "@nestjs/platform-socket.io";
import {createAdapter} from "@socket.io/redis-adapter";
import {Redis} from "ioredis";
import { ServerOptions } from "socket.io";

/**
 * Custom Socket.io adapter that uses Redis Pub/Sub under the hood. This allows multiple
 * instances of the server to coordinate Socket.io events across a cluster. See
 * docs/BE/backend-design-nestjs.md §7 for details.
 */

export class RedisIoAdapter extends IoAdapter {
    

    private pubClient!: Redis;
    private subClient!: Redis;

    createIOServer(port: number, options?: ServerOptions) {  
        const server = super.createIOServer(port, {
            ...options,
            cors: {
            origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
            credentials: true,
        }
        });
        server.adapter(createAdapter(this.pubClient, this.subClient));
        return server;
    }

    async connectToRedis() {
        this.pubClient = new Redis(process.env.REDIS_URL!);
        this.subClient = this.pubClient.duplicate();
        await Promise.all([
            new Promise((resolve) => this.pubClient.once('ready', resolve)),
            new Promise((resolve) => this.subClient.once('ready', resolve))
        ]);
    }

}