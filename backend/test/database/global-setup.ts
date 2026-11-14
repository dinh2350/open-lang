import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Connection URL of the migrated template database in the test Postgres. */
    templateDatabaseUrl: string;
  }
}

// The image docker-compose.yml runs.
const POSTGRES_IMAGE = 'postgres:18-alpine';
const TEMPLATE_DATABASE = 'livekit_platform_template';

const backendDirectory = path.resolve(import.meta.dirname, '..', '..');
const prisma = path.join(backendDirectory, 'node_modules', '.bin', 'prisma');

/**
 * Starts one throwaway Postgres for the backend's tests and applies the
 * migrations once, to a template database. Each Vitest worker then copies
 * the template into a database of its own (see `test-database.ts`).
 */
export default async function startTestPostgres(project: TestProject) {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase(TEMPLATE_DATABASE)
    .start();
  const templateDatabaseUrl = container.getConnectionUri();
  await promisify(execFile)(prisma, ['migrate', 'deploy'], {
    cwd: backendDirectory,
    env: { ...process.env, DATABASE_URL: templateDatabaseUrl },
  });
  project.provide('templateDatabaseUrl', templateDatabaseUrl);

  return async () => {
    await container.stop();
  };
}
