// src/modules/messages/messages.module.ts
import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { AttachmentsService } from './attachments.service';

/**
 * MessagesModule → Prisma (global), EventEmitter (global), ContactsModule (the cross-cutting
 * `canInteract()` block guard for DM sends), ConversationsModule (re-exported so the realtime
 * gateway can resolve conversation rooms). It depends on EventEmitter — never on
 * RealtimeModule — so persist-then-broadcast stays one-directional (backend-design §3, §7).
 */
@Module({
  imports: [ContactsModule, ConversationsModule],
  controllers: [MessagesController],
  providers: [MessagesService, AttachmentsService],
  exports: [MessagesService],
})
export class MessagesModule {}
