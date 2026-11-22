import type { User, UserDetails } from '@open-lang/shared';
import type { User as UserRecord } from '../generated/prisma/client.js';

/** A User as the API returns it: never the password hash. */
export function toUser(record: UserRecord): User {
  return { id: record.id, email: record.email, role: record.role };
}

/** A User as an Admin sees them: never the password hash. */
export function toUserDetails(record: UserRecord): UserDetails {
  return {
    ...toUser(record),
    locked: record.locked,
    createdAt: record.createdAt.toISOString(),
  };
}
