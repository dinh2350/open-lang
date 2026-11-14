import { randomBytes } from 'node:crypto';
import type {
  AuthResponse,
  registerRequestSchema,
  signInRequestSchema,
  User,
} from '@livekit-platform/shared';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthTokenService } from './auth-token.service.js';
import { toUser } from './users.js';

export type ValidRegisterRequest = z.output<typeof registerRequestSchema>;
export type ValidSignInRequest = z.output<typeof signInRequestSchema>;

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
  ) {}

  /** Creates a Member and signs them in. */
  async register(request: ValidRegisterRequest): Promise<AuthResponse> {
    const passwordHash = await argon2.hash(request.password);
    const record = await this.prisma.user
      .create({ data: { email: request.email, passwordHash } })
      .catch((error: unknown) => {
        throw isUniqueConstraintViolation(error)
          ? new ConflictException('An account with this email already exists.')
          : error;
      });
    return this.signedIn(toUser(record));
  }

  async signIn(request: ValidSignInRequest): Promise<AuthResponse> {
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
    return this.signedIn(toUser(record));
  }

  private async signedIn(user: User): Promise<AuthResponse> {
    return { authToken: await this.authTokens.issueAuthToken(user), user };
  }
}
