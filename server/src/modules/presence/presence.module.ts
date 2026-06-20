import { Module } from "@nestjs/common";
import { PresenceService } from "./presence.service";
import { PrismaModule } from "@prisma-module/prisma.module";
import { RedisModule } from "@redis/redis.module";


@Module({
imports: [PrismaModule, RedisModule],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
