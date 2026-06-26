// src/modules/conversations/conversations.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ConversationsService } from './conversations.service';
import { OpenDmDto } from './dto/open-dm.dto';
import { MarkReadDto } from './dto/mark-read.dto';

/**
 * Maps 1:1 to docs/contract/conversations.openapi.yaml. Controllers stay thin: validate +
 * delegate. Every route is authenticated by the global JwtAuthGuard. The literal `dm`
 * sub-path is declared before the `:conversationId` route so it wins over it.
 */
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.conversations.list(user.id, query.limit, query.cursor);
  }

  /**
   * Idempotent open-or-create: 200 for an existing DM, 201 for a new one. The status is
   * set dynamically, so we write directly to the (passthrough) response.
   */
  @Post('dm')
  async openDm(
    @CurrentUser() user: AuthUser,
    @Body() dto: OpenDmDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { conversation, created } = await this.conversations.openDm(user.id, dto.userId);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return conversation;
  }

  @Get(':conversationId')
  getOne(@CurrentUser() user: AuthUser, @Param('conversationId') conversationId: string) {
    return this.conversations.getOne(user.id, conversationId);
  }

  @Post(':conversationId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: MarkReadDto,
  ): Promise<void> {
    return this.conversations.markRead(user.id, conversationId, dto.lastReadMessageId);
  }
}
