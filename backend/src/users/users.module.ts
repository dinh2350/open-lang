import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/** Admins manage Users. */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
