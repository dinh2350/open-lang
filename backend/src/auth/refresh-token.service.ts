import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { User as UserRecord } from '../generated/prisma/client.js';
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

/** A new refresh token, and what to store about it. */
function newRefreshToken(userId: string) {
  const refreshToken = randomBytes(32).toString('base64url');
  return {
    refreshToken,
    record: {
      userId,
      tokenHash: hashOf(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MILLISECONDS),
    },
  };
}

/** The User a refresh token belonged to, and the refresh token that replaces it. */
export interface Rotated {
  readonly user: UserRecord;
  readonly refreshToken: string;
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
    const { refreshToken, record } = newRefreshToken(userId);
    await this.prisma.refreshToken.create({ data: record });
    return refreshToken;
  }

  /**
   * Revokes a refresh token and issues the one that replaces it. A missing,
   * unknown, revoked or expired refresh token gets `401`.
   *
   * A refresh token that was already rotated has been used twice, so
   * someone else has a copy of it. That revokes every refresh token of its
   * User, which signs them out everywhere.
   */
  async rotate(refreshToken: string | undefined): Promise<Rotated> {
    const current =
      refreshToken === undefined
        ? null
        : await this.prisma.refreshToken.findUnique({
            where: { tokenHash: hashOf(refreshToken) },
            include: { user: true, replacedBy: { select: { id: true } } },
          });
    if (current === null) {
      throw new UnauthorizedException();
    }
    if (current.replacedBy !== null) {
      return this.signOutEverywhere(current.userId);
    }
    if (current.revokedAt !== null || current.expiresAt <= new Date()) {
      throw new UnauthorizedException();
    }
    const next = newRefreshToken(current.userId);
    if (!(await this.replace(current.id, next.record))) {
      // Another request rotated it since it was read.
      return this.signOutEverywhere(current.userId);
    }
    return { user: current.user, refreshToken: next.refreshToken };
  }

  /** Revokes every refresh token of a User, which signs them out everywhere. */
  async revokeAllOf(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async signOutEverywhere(userId: string): Promise<never> {
    await this.revokeAllOf(userId);
    throw new UnauthorizedException();
  }

  /**
   * Revokes a refresh token and stores the one that replaces it, unless the
   * token was revoked in the meantime. Then it returns false.
   */
  private replace(
    id: string,
    replacement: ReturnType<typeof newRefreshToken>['record'],
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      // Postgres makes a concurrent revocation of the same row wait for
      // this one and then match nothing, so only one request rotates it.
      const { count } = await transaction.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) {
        return false;
      }
      await transaction.refreshToken.create({
        data: { ...replacement, replacesId: id },
      });
      return true;
    });
  }
}
