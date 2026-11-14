import type {
  AuthResponse,
  registerRequestSchema,
  User,
} from '@livekit-platform/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import type { z } from 'zod';
import { Prisma, type User as UserRecord } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthTokenService } from './auth-token.service.js';

export type ValidRegisterRequest = z.output<typeof registerRequestSchema>;

/** The only unique column a new User can clash on is the email. */
function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

/** A User as the API returns it: never the password hash. */
export function toUser(record: UserRecord): User {
  return { id: record.id, email: record.email, role: record.role };
}

@Injectable()
export class AuthService {
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

  private async signedIn(user: User): Promise<AuthResponse> {
    return { authToken: await this.authTokens.issueAuthToken(user), user };
  }
}
