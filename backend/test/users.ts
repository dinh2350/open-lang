import {
  type AuthResponse,
  authResponseSchema,
} from '@livekit-platform/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';

export const PASSWORD = 'correct horse battery staple';

/** Registers a User through the API, as a person would, and returns the response body. */
export async function registerUser(
  app: INestApplication<App>,
  email = 'ada@example.test',
  password = PASSWORD,
): Promise<AuthResponse> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password });
  if (response.status !== 201) {
    throw new Error(
      `Registering ${email} failed with status ${String(response.status)}`,
    );
  }
  return authResponseSchema.parse(response.body);
}
