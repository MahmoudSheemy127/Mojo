import { AppEvent, PresenceChangedPayload } from "@events/app-events";
import { OnEvent } from "@nestjs/event-emitter";
import { Injectable } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";


@Injectable()
export class RealtimeListener {

    constructor(
        private readonly gateway: RealtimeGateway
    ) {}



    @OnEvent(AppEvent.PresenceChanged)
    handlePresenceChanged(payload: PresenceChangedPayload) {
        // TODO: replace with per-contact fan-out when ContactsModule is implemented
        this.gateway.server.emit('presence:changed', payload);
    }

}