import type { Role, User, UserDetails } from '@open-live-agent/shared';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { Prisma, type User as UserRecord } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefreshTokenService } from '../refresh-tokens/refresh-token.service.js';
import { toUserDetails } from './user.mapper.js';

/**
 * Locks the row of every unlocked Admin until the transaction ends, and
 * returns their ids. Every change that could leave the app without an
 * unlocked Admin takes these locks first, so two Admins demoting or locking
 * each other at the same moment can't both count the other as the remaining
 * Admin: the second one waits, then counts again.
 */
async function lockUnlockedAdmins(
  transaction: Prisma.TransactionClient,
): Promise<string[]> {
  const admins = await transaction.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE role = 'admin' AND NOT locked FOR UPDATE`;
  return admins.map((admin) => admin.id);
}

// lockUnlockedAdmins relies on READ COMMITTED: a query that waited for a
// lock re-reads the rows that changed meanwhile.
const LOCKS_UNLOCKED_ADMINS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

function isTheOnlyAdmin(userId: string, adminIds: readonly string[]): boolean {
  return adminIds.length === 1 && adminIds[0] === userId;
}

/** The User with this id. `404` when nobody has it. */
async function findUser(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<UserRecord> {
  const user = await transaction.user.findUnique({ where: { id: userId } });
  if (user === null) {
    throw new NotFoundException('No User has this id.');
  }
  return user;
}

/** The User records, and what Admins do with Users. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  /** The User with this id, or null when nobody has it. */
  findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** The User with this email, or null when nobody has it. */
  findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Any one Admin, or null when there is none. */
  findAnAdmin(): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({ where: { role: 'admin' } });
  }

  /** Creates a User; a Member unless `role` says otherwise. */
  create(data: {
    readonly email: string;
    readonly passwordHash: string;
    readonly role?: Role;
  }): Promise<UserRecord> {
    return this.prisma.user.create({ data });
  }

  /** Every User, oldest first. */
  async listUsers(): Promise<UserDetails[]> {
    const records = await this.prisma.user.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return records.map(toUserDetails);
  }

  /** Changes another User's Role. An Admin may not change their own. */
  async changeRole(
    admin: User,
    userId: string,
    role: Role,
  ): Promise<UserDetails> {
    if (userId === admin.id) {
      throw new ConflictException("You can't change your own Role.");
    }
    return this.prisma.$transaction(async (transaction) => {
      const adminIds = await lockUnlockedAdmins(transaction);
      await findUser(transaction, userId);
      if (role === 'member' && isTheOnlyAdmin(userId, adminIds)) {
        throw new ConflictException(
          "You can't demote the last unlocked Admin.",
        );
      }
      return toUserDetails(
        await transaction.user.update({
          where: { id: userId },
          data: { role },
        }),
      );
    }, LOCKS_UNLOCKED_ADMINS);
  }

  /**
   * Locks or unlocks another User. Locking also signs them out everywhere,
   * in the same transaction, so a Locked User never keeps a refresh token.
   * An Admin may not lock themselves.
   */
  async changeLocked(
    admin: User,
    userId: string,
    locked: boolean,
  ): Promise<UserDetails> {
    if (locked && userId === admin.id) {
      throw new ConflictException("You can't lock yourself.");
    }
    return this.prisma.$transaction(async (transaction) => {
      const adminIds = await lockUnlockedAdmins(transaction);
      await findUser(transaction, userId);
      if (locked && isTheOnlyAdmin(userId, adminIds)) {
        throw new ConflictException("You can't lock the last unlocked Admin.");
      }
      // Changing the User's row first makes a concurrent refresh wait for
      // this transaction, so the revocation below sees its new refresh token.
      const user = await transaction.user.update({
        where: { id: userId },
        data: { locked },
      });
      if (locked) {
        await this.refreshTokens.revokeAllOf(userId, transaction);
      }
      return toUserDetails(user);
    }, LOCKS_UNLOCKED_ADMINS);
  }

  /**
   * Sets a new password for a User who forgot theirs, and signs them out
   * everywhere in the same transaction, so no refresh token they hold from
   * before keeps them signed in.
   */
  async setPassword(userId: string, password: string): Promise<void> {
    // Hashing is slow on purpose, so it happens before the transaction.
    const passwordHash = await argon2.hash(password);
    await this.prisma.$transaction(async (transaction) => {
      await findUser(transaction, userId);
      await transaction.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await this.refreshTokens.revokeAllOf(userId, transaction);
    });
  }
}
