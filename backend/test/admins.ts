import {
  type AuthResponse,
  authResponseSchema,
} from '@livekit-platform/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { seedFirstAdmin } from '../src/users/first-admin.js';
import { PASSWORD } from './users.js';

/** Signs a User in through the API and returns the response body. */
export async function signInUser(
  app: INestApplication<App>,
  email: string,
  password = PASSWORD,
): Promise<AuthResponse> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .send({ email, password });
  if (response.status !== 200) {
    throw new Error(
      `Signing in ${email} failed with status ${String(response.status)}`,
    );
  }
  return authResponseSchema.parse(response.body);
}

/**
 * Creates the first Admin as `pnpm db:seed` does, then signs them in through
 * the API.
 */
export async function signInFirstAdmin(
  app: INestApplication<App>,
  email = 'grace@example.test',
): Promise<AuthResponse> {
  await seedFirstAdmin(app.get(PrismaService), {
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: PASSWORD,
  });
  return signInUser(app, email);
}
