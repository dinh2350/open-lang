import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { parseCookie } from 'cookie';
import type { Request, Response } from 'express';
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

/** Tells the browser to delete the refresh cookie. */
export function clearRefreshCookie(response: Response): void {
  // The browser only deletes a cookie set with the same attributes.
  response.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: AUTH_ROUTES,
  });
}

/** The refresh token in the request's refresh cookie, if it has one. */
export const RefreshTokenCookie = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    parseCookie(
      context.switchToHttp().getRequest<Request>().headers.cookie ?? '',
    )[REFRESH_COOKIE],
);
