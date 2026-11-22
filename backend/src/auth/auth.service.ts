import { randomBytes } from 'node:crypto';
import type { User } from '@open-live-agent/shared';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthTokenService } from './auth-token.service.js';
import type {
  SignedIn,
  ValidRegisterRequest,
  ValidSignInRequest,
} from './auth.types.js';
import { AccountLockedException } from './exceptions/account-locked.exception.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { toUser } from './users.js';

/** The same for a wrong email and a wrong password, so it reveals neither. */
const WRONG_CREDENTIALS = 'Wrong email or password.';

/** The only unique column a new User can clash on is the email. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  /**
   * Checked when nobody has the email, so that a sign-in takes as long
   * whether or not the email belongs to a User.
   */
  private unknownUserPasswordHash: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokens: AuthTokenService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /** Creates a Member and signs them in. */
  async register(request: ValidRegisterRequest): Promise<SignedIn> {
    const passwordHash = await argon2.hash(request.password);
    const record = await this.prisma.user
      .create({ data: { email: request.email, passwordHash } })
      .catch((error: unknown) => {
        throw isUniqueConstraintViolation(error)
          ? new ConflictException('An account with this email already exists.')
          : error;
      });
    return this.signedIn(
      toUser(record),
      await this.refreshTokens.issue(record.id),
    );
  }

  async signIn(request: ValidSignInRequest): Promise<SignedIn> {
    const record = await this.prisma.user.findUnique({
      where: { email: request.email },
    });
    this.unknownUserPasswordHash ??= argon2.hash(randomBytes(32));
    const passwordHash =
      record?.passwordHash ?? (await this.unknownUserPasswordHash);
    const passwordMatches = await argon2.verify(passwordHash, request.password);
    if (record === null || !passwordMatches) {
      throw new UnauthorizedException(WRONG_CREDENTIALS);
    }
    // Only after the password matched, so that it reveals nothing to anyone
    // who doesn't know it.
    if (record.locked) {
      throw new AccountLockedException();
    }
    return this.signedIn(
      toUser(record),
      await this.refreshTokens.issue(record.id),
    );
  }

  /**
   * Signs the User of a refresh token in again, without their password: a
   * new Auth Token, and the refresh token rotated.
   */
  async refresh(refreshToken: string | undefined): Promise<SignedIn> {
    const rotated = await this.refreshTokens.rotate(refreshToken);
    return this.signedIn(toUser(rotated.user), rotated.refreshToken);
  }

  private async signedIn(user: User, refreshToken: string): Promise<SignedIn> {
    return {
      authToken: await this.authTokens.issueAuthToken(user),
      user,
      refreshToken,
    };
  }
}
