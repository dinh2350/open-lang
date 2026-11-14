import { roleSchema, type User } from '@livekit-platform/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JsonWebTokenError, JwtService } from '@nestjs/jwt';
import { z } from 'zod';

const authTokenClaimsSchema = z.object({
  sub: z.uuid(),
  role: roleSchema,
});

/**
 * Issues and verifies Auth Tokens: HS256 JWTs signed with JWT_SECRET that
 * expire after 15 minutes and carry the User id (`sub`) and Role (ADR 0003).
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService) {}

  issueAuthToken(user: User): Promise<string> {
    return this.jwt.signAsync({ role: user.role }, { subject: user.id });
  }

  /**
   * Returns the id of the User an Auth Token was issued to. A token that is
   * not signed with JWT_SECRET, has expired, or carries unexpected claims
   * gets `401`.
   */
  async userIdOf(authToken: string): Promise<string> {
    const verified = await this.jwt
      .verifyAsync<object>(authToken)
      .catch((error: unknown) => {
        // Expired and not-yet-valid tokens are JsonWebTokenErrors too.
        throw error instanceof JsonWebTokenError
          ? new UnauthorizedException()
          : error;
      });
    const claims = authTokenClaimsSchema.safeParse(verified);
    if (!claims.success) {
      throw new UnauthorizedException();
    }
    return claims.data.sub;
  }
}
