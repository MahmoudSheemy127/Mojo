// src/modules/contacts/contacts.module.ts
import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { NotificationsService } from '@modules/notifications/notifications.service';

/**
 * ContactsModule → Prisma (global). Exports ContactsService so other modules
 * (conversations, messages, groups) can reuse `canInteract()` as the cross-cutting
 * block guard (NF-13, contacts.md).
 */
@Module({
  controllers: [ContactsController],
  providers: [ContactsService, NotificationsService],
  exports: [ContactsService],
})
export class ContactsModule {}
