import type { User } from '@open-live-agent/shared';
import type { User as UserRecord } from '../generated/prisma/client.js';

/** A User as the API returns it: never the password hash. */
export function toUser(record: UserRecord): User {
  return { id: record.id, email: record.email, role: record.role };
}
