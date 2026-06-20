// src/modules/users/users.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService, UploadedAvatar } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetPresenceDto } from './dto/set-presence.dto';
import { SearchUsersDto } from './dto/search-users.dto';

/**
 * Maps 1:1 to docs/contract/users.openapi.yaml. Controllers stay thin: validate +
 * delegate. Every route is authenticated by the global JwtAuthGuard.
 *
 * NOTE: `/users/search` is declared BEFORE `/users/:userId` so the literal segment
 * wins over the param route.
 */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Put('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedAvatar) {
    return this.users.setAvatar(user.id, file);
  }

  @Delete('me/avatar')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAvatar(@CurrentUser() user: AuthUser): Promise<void> {
    return this.users.deleteAvatar(user.id);
  }

  @Patch('me/presence')
  setPresence(@CurrentUser() user: AuthUser, @Body() dto: SetPresenceDto) {
    return this.users.setPresence(user.id, dto.status);
  }

  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() query: SearchUsersDto) {
    return this.users.search(user.id, query.q, query.limit, query.cursor);
  }

  @Get(':userId')
  getUser(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.users.getPublic(user.id, userId);
  }
}
