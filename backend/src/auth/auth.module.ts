import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { z } from 'zod';
import { parseEnv } from '../config/parse-env.js';
import { AuthTokenService } from './auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

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
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthTokenService],
})
export class AuthModule {}
