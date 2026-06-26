// src/modules/conversations/conversations.module.ts
import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

/**
 * ConversationsModule → Prisma (global), EventEmitter (global), ContactsModule (the
 * cross-cutting `canInteract()` block guard, NF-13). Exports ConversationsService so
 * MessagesModule and RealtimeModule (inbound read markers + `conversation:new` fan-out)
 * can reuse it. It depends on EventEmitter — never on RealtimeModule — keeping the
 * persist-then-broadcast flow one-directional (backend-design-nestjs.md §3).
 */
@Module({
  imports: [ContactsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
