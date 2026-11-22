import type { INestApplication } from '@nestjs/common';
import { parseSetCookie, type SetCookie } from 'cookie';
import request, { type Response } from 'supertest';
import type { App } from 'supertest/types.js';
import { PASSWORD } from './users.js';

/** The cookie the browser keeps the refresh token in. */
const REFRESH_COOKIE = 'refresh_token';

/** The refresh cookie a response sets, as the browser reads it. */
export function refreshCookieSetBy(response: Response): SetCookie {
  const cookie = (response.get('Set-Cookie') ?? [])
    .map((header) => parseSetCookie(header))
    .find(({ name }) => name === REFRESH_COOKIE);
  if (cookie === undefined) {
    throw new Error(
      `The response (status ${String(response.status)}) sets no refresh cookie`,
    );
  }
  return cookie;
}

/** The refresh token a response puts in the refresh cookie. */
export function refreshTokenSetBy(response: Response): string {
  const { value } = refreshCookieSetBy(response);
  if (value === undefined || value === '') {
    throw new Error('The response clears the refresh cookie');
  }
  return value;
}

/** Calls an auth route as the browser does, with the refresh cookie if it holds one. */
function withRefreshCookie(
  app: INestApplication<App>,
  path: string,
  refreshToken: string | undefined,
): request.Test {
  const call = request(app.getHttpServer()).post(path);
  return refreshToken === undefined
    ? call
    : call.set('Cookie', `${REFRESH_COOKIE}=${refreshToken}`);
}

export function refresh(
  app: INestApplication<App>,
  refreshToken?: string,
): request.Test {
  return withRefreshCookie(app, '/api/auth/refresh', refreshToken);
}

export function signOut(
  app: INestApplication<App>,
  refreshToken?: string,
): request.Test {
  return withRefreshCookie(app, '/api/auth/sign-out', refreshToken);
}

/** Signs a User in through the API and returns the refresh token it sets. */
export async function signInForRefreshToken(
  app: INestApplication<App>,
  email = 'ada@example.test',
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/sign-in')
    .send({ email, password: PASSWORD });
  return refreshTokenSetBy(response);
}
