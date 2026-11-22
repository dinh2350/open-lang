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
import { PASSWORD } from './users.js';

describe('POST /api/auth/register', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  function register(body: object) {
    return request(app.getHttpServer()).post('/api/auth/register').send(body);
  }

  it('creates a Member, signs them in, and returns 201 with an Auth Token and the User', async () => {
    const response = await register({
      email: 'ada@example.test',
      password: PASSWORD,
    });

    expect(response.status).toBe(201);
    const { authToken, user } = authResponseSchema.parse(response.body);
    expect(user).toEqual({
      id: expect.stringMatching(/\S/) as unknown,
      email: 'ada@example.test',
      role: 'member',
    });
    await expect(verifyAuthToken(authToken)).resolves.toMatchObject({
      sub: user.id,
      role: 'member',
    });
  });

  it('issues an Auth Token that expires 15 minutes after it was issued', async () => {
    const response = await register({
      email: 'ada@example.test',
      password: PASSWORD,
    });

    const { authToken } = authResponseSchema.parse(response.body);
    const claims = await verifyAuthToken(authToken);
    expect(claims.exp - claims.iat).toBe(15 * 60);
  });

  it('accepts any password of 12 characters, with no composition rules', async () => {
    const response = await register({
      email: 'ada@example.test',
      password: 'abcdefghijkl',
    });

    expect(response.status).toBe(201);
  });

  it.each([
    [
      'an invalid email',
      { email: 'ada.example.test', password: PASSWORD },
      'email: Enter a valid email address.',
    ],
    [
      'a password shorter than 12 characters',
      { email: 'ada@example.test', password: 'abcdefghijk' },
      'password: Use at least 12 characters for your password.',
    ],
  ])(
    'rejects %s with 400 and a clear validation error',
    async (_case, body, error) => {
      const response = await register(body);

      expect(response.status).toBe(400);
      expect(errorResponseSchema.parse(response.body).message).toEqual([error]);
    },
  );

  it('rejects an email that is already taken with 409', async () => {
    await register({ email: 'ada@example.test', password: PASSWORD });

    const response = await register({
      email: 'ada@example.test',
      password: 'another long password',
    });

    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).message).toBe(
      'An account with this email already exists.',
    );
  });

  it('treats an email that differs only in case as taken', async () => {
    await register({ email: 'ada@example.test', password: PASSWORD });

    const response = await register({
      email: ' Ada@Example.TEST ',
      password: PASSWORD,
    });

    expect(response.status).toBe(409);
  });
});
