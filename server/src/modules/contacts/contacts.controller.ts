// src/modules/contacts/contacts.controller.ts
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
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { ContactsService } from './contacts.service';
import { SendRequestDto } from './dto/send-request.dto';
import { BlockUserDto } from './dto/block-user.dto';

/**
 * Maps 1:1 to docs/contract/contacts.openapi.yaml. Controllers stay thin: validate +
 * delegate. Every route is authenticated by the global JwtAuthGuard.
 *
 * NOTE: literal sub-paths (`requests`, `blocked`, `blocks/:userId`) are declared
 * BEFORE the `:userId` param route so they win over it.
 */
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  listFriends(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.contacts.listFriends(user.id, query.limit, query.cursor);
  }

  @Get('requests')
  listRequests(@CurrentUser() user: AuthUser) {
    return this.contacts.listRequests(user.id);
  }

  @Post('requests')
  @HttpCode(HttpStatus.CREATED)
  sendRequest(@CurrentUser() user: AuthUser, @Body() dto: SendRequestDto) {
    return this.contacts.sendRequest(user.id, dto.userId);
  }

  @Post('requests/:requestId/accept')
  @HttpCode(HttpStatus.OK)
  acceptRequest(@CurrentUser() user: AuthUser, @Param('requestId') requestId: string) {
    return this.contacts.acceptRequest(user.id, requestId);
  }

  @Post('requests/:requestId/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  declineRequest(
    @CurrentUser() user: AuthUser,
    @Param('requestId') requestId: string,
  ): Promise<void> {
    return this.contacts.declineRequest(user.id, requestId);
  }

  @Get('blocked')
  listBlocked(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    return this.contacts.listBlocked(user.id, query.limit, query.cursor);
  }

  @Post('blocks')
  @HttpCode(HttpStatus.CREATED)
  blockUser(@CurrentUser() user: AuthUser, @Body() dto: BlockUserDto) {
    return this.contacts.blockUser(user.id, dto.userId);
  }

  @Delete('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unblockUser(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<void> {
    return this.contacts.unblockUser(user.id, userId);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeContact(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<void> {
    return this.contacts.removeContact(user.id, userId);
  }
}
