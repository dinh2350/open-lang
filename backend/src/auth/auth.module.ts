import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { minutes, ThrottlerModule } from '@nestjs/throttler';
import { z } from 'zod';
import { parseEnv } from '../config/parse-env.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { RefreshTokenService } from './refresh-token.service.js';

const authEnvSchema = z.object({
  // HS256 needs a key of at least 256 bits.
  JWT_SECRET: z.string().min(32),
});

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: parseEnv('Auth', authEnvSchema, process.env).JWT_SECRET,
        signOptions: { algorithm: 'HS256', expiresIn: '15m' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
    // Only the routes that use ThrottlerGuard are limited: register and
    // sign-in, each to 5 requests a minute per IP, to slow password guessing.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: minutes(1), limit: 5 }],
      errorMessage: 'Too many attempts. Wait a minute, then try again.',
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthTokenService,
    RefreshTokenService,
    // Every route needs a signed-in User unless it is marked @Public().
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  // Locking a User and setting their password sign them out everywhere.
  exports: [RefreshTokenService],
})
export class AuthModule {}
