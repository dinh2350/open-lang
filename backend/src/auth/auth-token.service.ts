import type { User } from '@livekit-platform/shared';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Issues Auth Tokens: HS256 JWTs signed with JWT_SECRET that expire after
 * 15 minutes and carry the User id (`sub`) and Role (ADR 0003).
 */
@Injectable()
export class AuthTokenService {
  constructor(private readonly jwt: JwtService) {}

  issueAuthToken(user: User): Promise<string> {
    return this.jwt.signAsync({ role: user.role }, { subject: user.id });
  }
}
