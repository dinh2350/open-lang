import {
  authResponseSchema,
  errorResponseSchema,
} from '@open-live-agent/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verifyAuthToken } from './auth-tokens.js';
import { startTestApp, stopTestApp } from './test-app.js';
import { PASSWORD, registerUser } from './users.js';

describe('POST /api/auth/sign-in', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  function signIn(body: object) {
    return request(app.getHttpServer()).post('/api/auth/sign-in').send(body);
  }

  it('returns an Auth Token and the User for the right email and password', async () => {
    const registered = await registerUser(app, 'ada@example.test', PASSWORD);

    const response = await signIn({
      email: 'ada@example.test',
      password: PASSWORD,
    });

    expect(response.status).toBe(200);
    const { authToken, user } = authResponseSchema.parse(response.body);
    expect(user).toEqual(registered.user);
    await expect(verifyAuthToken(authToken)).resolves.toMatchObject({
      sub: registered.user.id,
      role: 'member',
    });
  });

  it('accepts the email in any case', async () => {
    await registerUser(app, 'ada@example.test', PASSWORD);

    const response = await signIn({
      email: 'Ada@Example.TEST',
      password: PASSWORD,
    });

    expect(response.status).toBe(200);
  });

  it('gives a wrong password and an unknown email the same generic 401', async () => {
    await registerUser(app, 'ada@example.test', PASSWORD);

    const wrongPassword = await signIn({
      email: 'ada@example.test',
      password: 'not the right password',
    });
    const unknownEmail = await signIn({
      email: 'grace@example.test',
      password: PASSWORD,
    });

    expect(wrongPassword.status).toBe(401);
    expect(errorResponseSchema.parse(wrongPassword.body).message).toBe(
      'Wrong email or password.',
    );
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('rejects a request without a password with 400', async () => {
    const response = await signIn({ email: 'ada@example.test', password: '' });

    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).message).toEqual([
      'password: Enter your password.',
    ]);
  });
});
