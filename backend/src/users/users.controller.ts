import {
  type ChangeLockedRequest,
  changeLockedRequestSchema,
  type ChangeRoleRequest,
  changeRoleRequestSchema,
  type SetPasswordRequest,
  setPasswordRequestSchema,
  type User,
  type UserDetails,
  type UsersResponse,
} from '@livekit-platform/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../auth/authentication.guard.js';
import { AdminOnly } from '../auth/role.guard.js';
import { UsersService } from './users.service.js';

/** The Admin API for managing Users. Members get `403`. */
@AdminOnly()
@Controller('admin/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async listUsers(): Promise<UsersResponse> {
    return { users: await this.users.listUsers() };
  }

  /** `409` when an Admin changes their own Role or demotes the last Admin. */
  @Put(':id/role')
  changeRole(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body({ schema: changeRoleRequestSchema }) request: ChangeRoleRequest,
  ): Promise<UserDetails> {
    return this.users.changeRole(admin, userId, request.role);
  }

  /**
   * Locks or unlocks a User. `409` when an Admin locks themselves or the
   * last unlocked Admin.
   */
  @Put(':id/locked')
  changeLocked(
    @CurrentUser() admin: User,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body({ schema: changeLockedRequestSchema }) request: ChangeLockedRequest,
  ): Promise<UserDetails> {
    return this.users.changeLocked(admin, userId, request.locked);
  }

  /** Sets a new password for a User who forgot theirs, and signs them out everywhere. */
  @Put(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  setPassword(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body({ schema: setPasswordRequestSchema }) request: SetPasswordRequest,
  ): Promise<void> {
    return this.users.setPassword(userId, request.password);
  }
}
