import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RefreshTokenService } from './refresh-token.service.js';

/** Refresh tokens: what keeps a User signed in without their password. */
@Module({
  imports: [PrismaModule],
  providers: [RefreshTokenService],
  exports: [RefreshTokenService],
})
export class RefreshTokensModule {}
