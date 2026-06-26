// src/modules/notifications/notifications.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { NotificationsService } from './notifications.service';
import { MarkSeenDto } from './dto/mark-seen.dto';

/**
 * Maps 1:1 to docs/contract/notifications.openapi.yaml. Controllers stay thin: validate +
 * delegate. Every route is authenticated by the global JwtAuthGuard. The feed covers
 * invites, requests, mentions, and system events — message notifications are per-conversation
 * unread badges, not feed rows.
 */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.notifications.list(user.id, query.limit, query.cursor);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.notifications.count(user.id);
  }

  @Post('seen')
  @HttpCode(HttpStatus.NO_CONTENT)
  markSeen(@CurrentUser() user: AuthUser, @Body() dto: MarkSeenDto): Promise<void> {
    return this.notifications.markSeen(user.id, dto.ids);
  }
}
