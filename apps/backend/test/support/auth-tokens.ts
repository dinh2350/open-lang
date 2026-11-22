import { randomBytes } from 'node:crypto';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { testEnv } from './test-app.js';

const jwt = new JwtService({ secret: testEnv.JWT_SECRET });

export interface AuthTokenClaims {
  readonly sub: string;
  readonly role: string;
  readonly iat: number;
  readonly exp: number;
}

/** Checks an Auth Token's HS256 signature with the test JWT_SECRET and returns its claims. */
export function verifyAuthToken(authToken: string): Promise<AuthTokenClaims> {
  return jwt.verifyAsync<AuthTokenClaims>(authToken, {
    algorithms: ['HS256'],
  });
}

/**
 * Signs an Auth Token as the backend would, with the test JWT_SECRET, unless
 * the options say otherwise. It is issued now unless `iat` says when.
 */
export function signAuthToken(
  claims: {
    readonly sub: string;
    readonly role: string;
    readonly iat?: number;
  },
  options: JwtSignOptions = {},
): string {
  return jwt.sign(
    { role: claims.role, iat: claims.iat ?? Math.floor(Date.now() / 1000) },
    {
      algorithm: 'HS256',
      expiresIn: '15m',
      subject: claims.sub,
      ...options,
    },
  );
}

/** A JWT_SECRET the backend doesn't use. */
export function anotherSecret(): string {
  return randomBytes(32).toString('base64url');
}
