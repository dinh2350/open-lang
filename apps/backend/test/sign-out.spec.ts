import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  refresh,
  refreshCookieSetBy,
  refreshTokenSetBy,
  signInForRefreshToken,
  signOut,
} from './support/refresh-cookies.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

describe('POST /api/auth/sign-out', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  /** The browser deletes a cookie set again with the same path and an expiry in the past. */
  function expectRefreshCookieCleared(
    response: Awaited<ReturnType<typeof signOut>>,
  ) {
    const cleared = refreshCookieSetBy(response);
    expect(cleared).toMatchObject({ value: '', path: '/api/auth' });
    expect(cleared.expires?.getTime()).toBeLessThan(Date.now());
  }

  it('revokes the refresh token, clears the cookie, and returns 204', async () => {
    await registerUser(app);
    const refreshToken = await signInForRefreshToken(app);

    const response = await signOut(app, refreshToken);

    expect(response.status).toBe(204);
    expectRefreshCookieCleared(response);
    expect((await refresh(app, refreshToken)).status).toBe(401);
  });

  it('revokes a refresh token that was rotated since sign-in', async () => {
    await registerUser(app);
    const rotated = refreshTokenSetBy(
      await refresh(app, await signInForRefreshToken(app)),
    );

    await signOut(app, rotated);

    expect((await refresh(app, rotated)).status).toBe(401);
  });

  it('leaves the User signed in on their other devices', async () => {
    await registerUser(app);
    const thisDevice = await signInForRefreshToken(app);
    const otherDevice = await signInForRefreshToken(app);

    await signOut(app, thisDevice);

    expect((await refresh(app, otherDevice)).status).toBe(200);
  });

  it.each([
    ['without a refresh cookie', undefined],
    ['with a refresh token the backend never issued', 'not-a-refresh-token'],
  ])('clears the cookie and returns 204 %s', async (_case, refreshToken) => {
    const response = await signOut(app, refreshToken);

    expect(response.status).toBe(204);
    expectRefreshCookieCleared(response);
  });
});
