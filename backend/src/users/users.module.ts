import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/** The User records, and the Admin API for managing Users. */
@Module({
  imports: [PrismaModule, RefreshTokensModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
