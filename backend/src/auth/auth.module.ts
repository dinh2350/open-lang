import { parseEnv } from '@open-live-agent/shared';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { z } from 'zod';
import { AuthTokenService } from './auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RefreshTokensModule } from '../refresh-tokens/refresh-tokens.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';

const authEnvSchema = z.object({
  // HS256 needs a key of at least 256 bits.
  JWT_SECRET: z.string().min(32),
});

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: parseEnv(
          authEnvSchema,
          process.env,
          'Invalid Auth settings in the backend environment',
        ).JWT_SECRET,
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
