// src/modules/groups/groups.module.ts
import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { MembersService } from './members.service';
import { InvitesService } from './invites.service';

/**
 * GroupsModule → Prisma (global), EventEmitter (global), ContactsModule (the cross-cutting
 * block guard + `areFriends` contact check, NF-13). It depends on EventEmitter — never on
 * RealtimeModule — keeping persist-then-broadcast one-directional (backend-design-nestjs.md
 * §3). Exports GroupsService so RealtimeModule can resolve per-recipient group views for the
 * `group:updated` fan-out.
 */
@Module({
  imports: [ContactsModule],
  controllers: [GroupsController],
  providers: [GroupsService, MembersService, InvitesService],
  exports: [GroupsService],
})
export class GroupsModule {}
