import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** How long a refresh token keeps a User signed in. */
export const REFRESH_TOKEN_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

/**
 * Only the hash is stored, so the database alone can't sign anyone in. The
 * token is 256 random bits, so a fast hash is enough.
 */
function hashOf(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('base64url');
}

/**
 * Refresh tokens keep a User signed in without their password (ADR 0003).
 * Each is an opaque random value that expires 7 days after it is issued.
 */
@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Issues a new refresh token to a User. */
  async issue(userId: string): Promise<string> {
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashOf(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MILLISECONDS),
      },
    });
    return refreshToken;
  }
}
