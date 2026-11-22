import pg from 'pg';
import { inject } from 'vitest';

function databaseUrl(database: string): string {
  const url = new URL(inject('templateDatabaseUrl'));
  url.pathname = `/${database}`;
  return url.toString();
}

const templateDatabase = new URL(inject('templateDatabaseUrl')).pathname.slice(
  1,
);
// VITEST_POOL_ID tells the workers that run at the same time apart.
const workerDatabase = `open_lang_test_${process.env.VITEST_POOL_ID ?? '1'}`;

/** Connection URL of this Vitest worker's own database. */
export const testDatabaseUrl = databaseUrl(workerDatabase);

async function withConnection<T>(
  url: string,
  use: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await use(client);
  } finally {
    await client.end();
  }
}

/** Copies the migrated template into this worker's database, unless an earlier test file did. */
export async function createWorkerDatabase(): Promise<void> {
  await withConnection(databaseUrl('postgres'), async (client) => {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [workerDatabase],
    );
    if (existing.rowCount === 0) {
      // Identifiers can't be query parameters; both names are fixed above.
      await client.query(
        `CREATE DATABASE "${workerDatabase}" TEMPLATE "${templateDatabase}"`,
      );
    }
  });
}

/** Empties every table except Prisma's migration history. */
export async function truncateTables(): Promise<void> {
  await withConnection(testDatabaseUrl, async (client) => {
    const tables = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    const tableList = tables.rows
      .map((table) => `"${table.tablename}"`)
      .join(', ');
    if (tableList !== '') {
      await client.query(`TRUNCATE TABLE ${tableList} CASCADE`);
    }
  });
}
