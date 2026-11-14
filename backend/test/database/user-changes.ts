import pg from 'pg';
import { vi } from 'vitest';
import { testDatabaseUrl } from './test-database.js';

export interface HeldChanges {
  /**
   * Waits until this many queries in this worker's database wait for a lock,
   * or until `release()`.
   */
  waitForQueuedQueries(count: number): Promise<void>;
  /** Lets the queued changes run, all at the same moment. */
  release(): Promise<void>;
}

async function queriesWaitingForALock(): Promise<number> {
  const client = new pg.Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    return result.rows[0]?.waiting ?? 0;
  } finally {
    await client.end();
  }
}

/** Takes a lock in a transaction of its own, and holds it until `release()`. */
async function holdLock(
  lock: string,
  values: unknown[] = [],
): Promise<HeldChanges> {
  const client = new pg.Client({ connectionString: testDatabaseUrl });
  await client.connect();
  await client.query('BEGIN');
  await client.query(lock, values);
  let released = false;
  return {
    async waitForQueuedQueries(count) {
      await vi.waitFor(
        async () => {
          const waiting = released ? count : await queriesWaitingForALock();
          if (waiting < count) {
            throw new Error(
              `${String(waiting)} of ${String(count)} queries wait for the lock`,
            );
          }
        },
        { timeout: 5000, interval: 20 },
      );
    },
    async release() {
      released = true;
      await client.query('COMMIT');
      await client.end();
    },
  };
}

/**
 * Holds back every change to Users, as a slow concurrent change would, until
 * `release()`. Reads go through, so requests pass the guards and then queue
 * up; releasing them makes them race, as requests that arrive together do.
 */
export function holdUserChanges(): Promise<HeldChanges> {
  // EXCLUSIVE blocks UPDATE and SELECT ... FOR UPDATE, but not plain reads.
  return holdLock('LOCK TABLE "User" IN EXCLUSIVE MODE');
}

/**
 * Holds back changes to the oldest refresh token of a User, as a slow
 * sign-out on that device would, until `release()`. A change to all of the
 * User's refresh tokens, such as a lock, stops there, halfway through.
 */
export function holdOldestRefreshTokenOf(userId: string): Promise<HeldChanges> {
  return holdLock(
    `SELECT id FROM "RefreshToken" WHERE "userId" = $1
     ORDER BY "createdAt", id LIMIT 1 FOR UPDATE`,
    [userId],
  );
}
