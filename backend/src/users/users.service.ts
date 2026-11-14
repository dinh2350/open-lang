import type { Role, User, UserDetails } from '@livekit-platform/shared';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type User as UserRecord } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Locks the row of every Admin until the transaction ends, and returns their
 * ids. Every change that could leave the app without an Admin takes these
 * locks first, so two Admins demoting each other at the same moment can't
 * both count the other as the remaining Admin: the second one waits, then
 * counts again.
 */
async function lockAdmins(
  transaction: Prisma.TransactionClient,
): Promise<string[]> {
  const admins = await transaction.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE role = 'admin' FOR UPDATE`;
  return admins.map((admin) => admin.id);
}

function isTheOnlyAdmin(userId: string, adminIds: readonly string[]): boolean {
  return adminIds.length === 1 && adminIds[0] === userId;
}

/** A User as an Admin sees them: never the password hash. */
function toUserDetails(record: UserRecord): UserDetails {
  return {
    id: record.id,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt.toISOString(),
  };
}

/** What Admins do with Users. */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.$transaction(
      async (transaction) => {
        const adminIds = await lockAdmins(transaction);
        const user = await transaction.user.findUnique({
          where: { id: userId },
        });
        if (user === null) {
          throw new NotFoundException('No User has this id.');
        }
        if (role === 'member' && isTheOnlyAdmin(userId, adminIds)) {
          throw new ConflictException("You can't demote the last Admin.");
        }
        return toUserDetails(
          await transaction.user.update({
            where: { id: userId },
            data: { role },
          }),
        );
      },
      // lockAdmins relies on READ COMMITTED: a query that waited for a lock
      // re-reads the rows that changed meanwhile.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }
}
