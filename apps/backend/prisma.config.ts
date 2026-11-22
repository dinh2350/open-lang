// Settings for the Prisma CLI (`prisma generate`, `prisma migrate`).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 doesn't read .env files. Load the backend's, as `pnpm dev` does;
// variables that are already set win.
const dotEnv = path.join(import.meta.dirname, '.env');
if (existsSync(dotEnv)) {
  process.loadEnvFile(dotEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // `prisma generate` needs no database; `prisma migrate` says when it's missing.
  datasource: { url: process.env.DATABASE_URL },
});
