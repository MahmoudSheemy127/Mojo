import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeListener } from "./realtime.listener";
import { PresenceModule } from "@modules/presence/presence.module";
import { WsJwtGuard } from "@common/guards/ws-jwt.guard";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [PresenceModule, JwtModule.register({})],
  providers: [RealtimeListener, RealtimeGateway, WsJwtGuard],
  exports: [RealtimeListener, RealtimeGateway],
})
export class RealtimeModule {}
