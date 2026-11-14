import {
  type ChangeRoleRequest,
  changeRoleRequestSchema,
  type User,
  type UserDetails,
  type UsersResponse,
} from '@livekit-platform/shared';
import {
  Body,
  Controller,
  Get,
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
}
