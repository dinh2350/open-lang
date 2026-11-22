import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { BackendEnv } from '../config/env.schema.js';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<BackendEnv, true>) => ({
        secret: config.getOrThrow('JWT_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256', expiresIn: '15m' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    UsersModule,
    RefreshTokensModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    // Every route needs a signed-in User unless it is marked @Public().
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
})
export class AuthModule {}
