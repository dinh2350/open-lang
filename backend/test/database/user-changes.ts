import pg from 'pg';
import { vi } from 'vitest';
import { testDatabaseUrl } from './test-database.js';

export interface HeldUserChanges {
  /** Waits until this many queries in this worker's database wait for a lock. */
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

/**
 * Holds back every change to Users, as a slow concurrent change would, until
 * `release()`. Reads go through, so requests pass the guards and then queue
 * up; releasing them makes them race, as requests that arrive together do.
 */
export async function holdUserChanges(): Promise<HeldUserChanges> {
  const client = new pg.Client({ connectionString: testDatabaseUrl });
  await client.connect();
  await client.query('BEGIN');
  // EXCLUSIVE blocks UPDATE and SELECT ... FOR UPDATE, but not plain reads.
  await client.query('LOCK TABLE "User" IN EXCLUSIVE MODE');
  return {
    async waitForQueuedQueries(count) {
      await vi.waitFor(
        async () => {
          const waiting = await queriesWaitingForALock();
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
      await client.query('COMMIT');
      await client.end();
    },
  };
}
