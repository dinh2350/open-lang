import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { minutes, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module.js';
import { backendEnvSchema } from './config/env.schema.js';
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
export class AppModule {
  /**
   * The application module with its validated environment. `forRoot` reads
   * the environment when it is called, so this runs at startup (and in each
   * test) instead of when this file is imported. The `.env` file is loaded by
   * `node --env-file-if-exists`, not here.
   */
  static async register(): Promise<DynamicModule> {
    return {
      module: AppModule,
      imports: [
        await ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validationSchema: backendEnvSchema,
        }),
      ],
    };
  }
}
