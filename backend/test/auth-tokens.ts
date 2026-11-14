import { JwtService } from '@nestjs/jwt';
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
