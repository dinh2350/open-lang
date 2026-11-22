import { Module } from '@nestjs/common';
import { minutes, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { LiveKitModule } from './livekit/livekit.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    AuthModule,
    HealthModule,
    LiveKitModule,
    UsersModule,
    // Only the routes that use ThrottlerGuard are limited: register and
    // sign-in, each to 5 requests a minute per IP, to slow password guessing.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: minutes(1), limit: 5 }],
      errorMessage: 'Too many attempts. Wait a minute, then try again.',
    }),
  ],
})
export class AppModule {}
