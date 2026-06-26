import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeListener } from "./realtime.listener";
import { PresenceModule } from "@modules/presence/presence.module";
import { ConversationsModule } from "@modules/conversations/conversations.module";
import { GroupsModule } from "@modules/groups/groups.module";
import { WsJwtGuard } from "@common/guards/ws-jwt.guard";
import { JwtModule } from "@nestjs/jwt";

@Module({
  imports: [PresenceModule, ConversationsModule, GroupsModule, JwtModule.register({})],
  providers: [RealtimeListener, RealtimeGateway, WsJwtGuard],
  exports: [RealtimeListener, RealtimeGateway],
})
export class RealtimeModule {}
