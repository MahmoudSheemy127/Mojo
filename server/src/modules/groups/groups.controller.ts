// src/modules/groups/groups.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { GroupRoles } from '../../common/decorators/group-roles.decorator';
import { GroupRoleGuard } from '../../common/guards/group-role.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { GroupsService } from './groups.service';
import { MembersService } from './members.service';
import { InvitesService } from './invites.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { AddMembersDto, JoinGroupDto } from './dto/invite.dto';

/**
 * Maps 1:1 to docs/contract/groups.openapi.yaml. Controllers stay thin: validate + delegate.
 * Every route is authenticated by the global JwtAuthGuard; admin-only routes additionally use
 * GroupRoleGuard + @GroupRoles('ADMIN'). The literal `join` path is declared before the
 * `:groupId` routes so it is not captured as a group id.
 */
@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly members: MembersService,
    private readonly invites: InvitesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user.id, dto);
  }

  /** Join via invite link — declared before `:groupId` so it wins the route match. */
  @Post('join')
  async join(
    @CurrentUser() user: AuthUser,
    @Body() dto: JoinGroupDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { group, created } = await this.invites.joinByLink(user.id, dto.inviteToken);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return group;
  }

  @Get(':groupId')
  getOne(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.groups.getOne(user.id, groupId);
  }

  @Patch(':groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles('ADMIN')
  update(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(user.id, groupId, dto);
  }

  @Delete(':groupId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('groupId') groupId: string): Promise<void> {
    return this.groups.delete(groupId);
  }

  @Get(':groupId/members')
  listMembers(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Query() query: PaginationDto,
  ) {
    return this.members.listMembers(user.id, groupId, query.limit, query.cursor);
  }

  @Post(':groupId/members')
  @UseGuards(GroupRoleGuard)
  @GroupRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  addMembers(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Body() dto: AddMembersDto,
  ) {
    return this.members.addMembers(user.id, groupId, dto);
  }

  @Patch(':groupId/members/:userId')
  @UseGuards(GroupRoleGuard)
  @GroupRoles('ADMIN')
  changeRole(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Body() dto: ChangeRoleDto,
  ) {
    return this.members.changeRole(user.id, groupId, userId, dto.role);
  }

  @Delete(':groupId/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.members.removeMember(user.id, groupId, userId);
  }

  @Post(':groupId/invite-link')
  @UseGuards(GroupRoleGuard)
  @GroupRoles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  createInviteLink(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.invites.createInviteLink(user.id, groupId);
  }
}
