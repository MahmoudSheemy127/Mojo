import { Injectable } from "@nestjs/common";
import { PrismaService } from "@prisma-module/prisma.service";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AppEvent, PresenceStatus } from "@events/app-events";
import { RedisService } from "@redis/redis.service";

@Injectable()
export class PresenceService {

constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
) {}

async increment(userId: string): Promise<void> {

    /* Increment connection count in Redis */
    const count = await this.redis.incr(`presence:${userId}`);

    /* Only transition on the first connection (0 → 1) */
    if(count === 1) {
        /* Check the user's prior status so we don't re-emit a no-op transition */
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { presence: true } });
        const priorStatus = user?.presence ?? 'OFFLINE';

        /* Move the user straight to ONLINE; the listener persists the committed status */
        if (priorStatus !== 'ONLINE') {
            this.eventEmitter.emit(AppEvent.PresenceChanged, { userId, status: 'online' satisfies PresenceStatus });
        }
    }

}


async decrement(userId: string): Promise<void> {

    /* Decrement connection count in Redis */
    const count = await this.redis.decr(`presence:${userId}`);

    /* If count becomes 0, wait grace period then recheck before marking offline */
    if (count === 0) {
        setTimeout(async () => {
            const finalCount = await this.redis.get(`presence:${userId}`);
            if (finalCount === '0') {
                this.eventEmitter.emit(AppEvent.PresenceChanged, { userId, status: 'offline' });
            }
        }, 30000);
    }

}


}
