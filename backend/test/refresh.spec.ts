import { authResponseSchema } from '@open-live-agent/shared';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAuthToken } from './auth-tokens.js';
import {
  refresh,
  refreshCookieSetBy,
  refreshTokenSetBy,
  signInForRefreshToken,
} from './refresh-cookies.js';
import { startTestApp, stopTestApp } from './test-app.js';
import { registerUser } from './users.js';

const ONE_MINUTE = 60_000;
const SEVEN_DAYS = 7 * 24 * 60 * ONE_MINUTE;

describe('POST /api/auth/refresh', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await startTestApp();
  });

  afterEach(async () => {
    vi.useRealTimers();
    await stopTestApp(app);
  });

  /** Moves the clock the backend reads forward. */
  function travelForward(milliseconds: number): void {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + milliseconds);
  }

  it('returns a new Auth Token for the User, and rotates the refresh token in the cookie', async () => {
    const { user } = await registerUser(app);
    const refreshToken = await signInForRefreshToken(app);

    const response = await refresh(app, refreshToken);

    expect(response.status).toBe(200);
    const body = authResponseSchema.parse(response.body);
    expect(body.user).toEqual(user);
    await expect(verifyAuthToken(body.authToken)).resolves.toMatchObject({
      sub: user.id,
      role: 'member',
    });
    const rotated = refreshCookieSetBy(response);
    expect(rotated).toMatchObject({ httpOnly: true, path: '/api/auth' });
    expect(rotated.value).not.toBe(refreshToken);
  });

  it('returns 401 without a refresh cookie', async () => {
    const response = await refresh(app);

    expect(response.status).toBe(401);
  });

  it('returns 401 for a refresh token the backend never issued', async () => {
    await registerUser(app);

    const response = await refresh(app, 'not-a-refresh-token');

    expect(response.status).toBe(401);
  });

  it('keeps a User signed in for up to 7 days after their last refresh token was issued', async () => {
    await registerUser(app);
    const refreshToken = await signInForRefreshToken(app);

    travelForward(SEVEN_DAYS - ONE_MINUTE);
    const response = await refresh(app, refreshToken);

    expect(response.status).toBe(200);
  });

  it('returns 401 for a refresh token issued more than 7 days ago', async () => {
    await registerUser(app);
    const refreshToken = await signInForRefreshToken(app);

    travelForward(SEVEN_DAYS + ONE_MINUTE);
    const response = await refresh(app, refreshToken);

    expect(response.status).toBe(401);
  });

  it('treats a refresh token that was already rotated as stolen: 401, and every refresh token of that User stops working', async () => {
    await registerUser(app);
    const stolen = await signInForRefreshToken(app);
    const onAnotherDevice = await signInForRefreshToken(app);
    const rotated = refreshTokenSetBy(await refresh(app, stolen));

    const reused = await refresh(app, stolen);

    expect(reused.status).toBe(401);
    expect((await refresh(app, rotated)).status).toBe(401);
    expect((await refresh(app, onAnotherDevice)).status).toBe(401);
  });

  it("leaves other Users signed in when someone reuses a User's rotated refresh token", async () => {
    await registerUser(app, 'ada@example.test');
    await registerUser(app, 'grace@example.test');
    const adas = await signInForRefreshToken(app, 'ada@example.test');
    const graces = await signInForRefreshToken(app, 'grace@example.test');
    await refresh(app, adas);

    await refresh(app, adas);

    expect((await refresh(app, graces)).status).toBe(200);
  });

  it('rotates a refresh token only once when two refreshes use it at the same time', async () => {
    await registerUser(app);
    const refreshToken = await signInForRefreshToken(app);

    const responses = await Promise.all([
      refresh(app, refreshToken),
      refresh(app, refreshToken),
    ]);

    const statuses = responses.map(({ status }) => status);
    expect(statuses.toSorted((a, b) => a - b)).toEqual([200, 401]);
  });
});
