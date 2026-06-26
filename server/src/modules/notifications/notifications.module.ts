// src/modules/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { MentionsListener } from './mentions.listener';

/**
 * NotificationsModule → Prisma (global) + EventEmitter (global). Exports NotificationsService
 * so the side-effecting domains (ContactsModule, GroupsModule, MessagesModule) can create
 * notifications via `create()`. It depends on EventEmitter — never on RealtimeModule —
 * keeping the persist-then-broadcast flow one-directional (backend-design-nestjs.md §3); the
 * `notification:new` socket push is the listener's job.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MentionsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
