import type {
  AuthResponse,
  registerRequestSchema,
  signInRequestSchema,
} from '@open-lang/shared';
import type { z } from 'zod';

export type ValidRegisterRequest = z.output<typeof registerRequestSchema>;
export type ValidSignInRequest = z.output<typeof signInRequestSchema>;

/** A signed-in User: the response body, plus the refresh token for the cookie. */
export interface SignedIn extends AuthResponse {
  readonly refreshToken: string;
}
