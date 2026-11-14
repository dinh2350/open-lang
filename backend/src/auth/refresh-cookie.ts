import type { Response } from 'express';
import { REFRESH_TOKEN_LIFETIME_MILLISECONDS } from './refresh-token.service.js';

const REFRESH_COOKIE = 'refresh_token';

/** The auth routes: the global `/api` prefix, then AuthController's path. */
const AUTH_ROUTES = '/api/auth';

/**
 * Puts a refresh token in a cookie that page scripts can't read, that the
 * browser sends only over HTTPS (or to localhost), only to the auth routes,
 * and never with a request from another site.
 */
export function setRefreshCookie(
  response: Response,
  refreshToken: string,
): void {
  response.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: AUTH_ROUTES,
    maxAge: REFRESH_TOKEN_LIFETIME_MILLISECONDS,
  });
}
