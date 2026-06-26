// src/modules/messages/messages.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { MessagesService } from './messages.service';
import { AttachmentsService, UploadedFile as MultipartFile } from './attachments.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesDto } from './dto/list-messages.dto';

/**
 * Maps 1:1 to docs/contract/messages.openapi.yaml. Controllers stay thin: validate +
 * delegate. Routes are declared with full paths (no controller prefix) because the contract
 * spans two roots — `/conversations/:id/messages` and `/messages/:id` / `/attachments`.
 * Every route is authenticated by the global JwtAuthGuard.
 */
@Controller()
export class MessagesController {
  constructor(
    private readonly messages: MessagesService,
    private readonly attachments: AttachmentsService,
  ) {}

  @Get('conversations/:conversationId/messages')
  list(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.messages.list(user.id, conversationId, query.limit, query.cursor);
  }

  @Post('conversations/:conversationId/messages')
  @HttpCode(HttpStatus.CREATED)
  send(
    @CurrentUser() user: AuthUser,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messages.send(user.id, conversationId, dto);
  }

  @Delete('messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('messageId') messageId: string,
  ): Promise<void> {
    return this.messages.softDelete(user.id, messageId);
  }

  @Post('attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: MultipartFile) {
    return this.attachments.upload(user.id, file);
  }
}
