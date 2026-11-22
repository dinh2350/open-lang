import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/configure-app.js';
import { testDatabaseUrl } from '../database/test-database.js';

export const testEnv = {
  LIVEKIT_URL: 'ws://livekit.test:7880',
  LIVEKIT_API_KEY: 'test-api-key',
  LIVEKIT_API_SECRET: 'test-api-secret-with-at-least-32-chars',
  AGENT_NAME: 'test-agent',
  JWT_SECRET: randomBytes(32).toString('base64url'),
  AGENT_API_KEY: 'test-agent-api-key-with-at-least-32-chars',
  DATABASE_URL: testDatabaseUrl,
} as const;

/**
 * Starts the real application module, configured as `main.ts` does, against
 * `testEnv` and this worker's test database. An override of `undefined`
 * removes that variable.
 */
export async function startTestApp(
  envOverrides: Readonly<Record<string, string | undefined>> = {},
): Promise<INestApplication<App>> {
  for (const [name, value] of Object.entries({ ...testEnv, ...envOverrides })) {
    vi.stubEnv(name, value);
  }
  const moduleRef = await Test.createTestingModule({
    imports: [await AppModule.register()],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  configureApp(app);
  await app.init();
  return app;
}

export async function stopTestApp(app: INestApplication<App>): Promise<void> {
  await app.close();
  vi.unstubAllEnvs();
}
