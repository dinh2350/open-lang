import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refreshCookieSetBy } from './support/refresh-cookies.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { PASSWORD, registerUser } from './support/users.js';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

/**
 * An opaque refresh token for 7 days that page scripts can't read, that the
 * browser sends only to the auth routes, and never from another site.
 */
const expectedRefreshCookie = {
  name: 'refresh_token',
  // At least 256 random bits, URL-safe; not a JWT.
  value: expect.stringMatching(/^[\w-]{43,}$/) as unknown,
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: SEVEN_DAYS_IN_SECONDS,
  expires: expect.any(Date) as unknown,
};

describe('The refresh cookie', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it('is set when a person registers', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'ada@example.test', password: PASSWORD });

    expect(response.status).toBe(201);
    expect(refreshCookieSetBy(response)).toEqual(expectedRefreshCookie);
  });

  it('is set when a User signs in', async () => {
    await registerUser(app, 'ada@example.test', PASSWORD);

    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-in')
      .send({ email: 'ada@example.test', password: PASSWORD });

    expect(response.status).toBe(200);
    expect(refreshCookieSetBy(response)).toEqual(expectedRefreshCookie);
  });

  it('holds a different refresh token for each sign-in', async () => {
    await registerUser(app, 'ada@example.test', PASSWORD);
    const signIn = () =>
      request(app.getHttpServer())
        .post('/api/auth/sign-in')
        .send({ email: 'ada@example.test', password: PASSWORD });

    const first = refreshCookieSetBy(await signIn());
    const second = refreshCookieSetBy(await signIn());

    expect(first.value).not.toBe(second.value);
  });
});
