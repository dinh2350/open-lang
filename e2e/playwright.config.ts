import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { defineConfig, devices } from '@playwright/test';

// Expects the Docker Compose stack to be up; the root `test:e2e` script starts it.
const LIVEKIT_URL = 'ws://localhost:7880';
const BACKEND_URL = 'http://localhost:3000';
const FRONTEND_URL = 'http://localhost:5173';
const AGENT_HEALTH_URL = 'http://localhost:8081';

// Compose publishes Postgres on POSTGRES_PORT, from the shell or else the
// root .env. The end-to-end tests use a database of their own on it.
const rootEnvFile = path.join(import.meta.dirname, '..', '.env');
const rootEnv = existsSync(rootEnvFile)
  ? parseEnv(readFileSync(rootEnvFile, 'utf8'))
  : {};
const postgresPort =
  process.env.POSTGRES_PORT ?? rootEnv.POSTGRES_PORT ?? '5432';
const DATABASE_URL = `postgresql://livekit_platform:livekit_platform@localhost:${postgresPort}/livekit_platform_e2e`;

// Several git worktrees share one LiveKit server, and a developer's own Agent
// may be registered with it too. A run-unique Agent name makes sure the Agent
// started here is the one that receives the dispatch. Playwright workers
// inherit it through the environment, so they see the same name.
process.env.E2E_AGENT_NAME ??= `e2e-agent-${randomUUID()}`;

const liveKitEnv = {
  LIVEKIT_URL,
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
  AGENT_NAME: process.env.E2E_AGENT_NAME,
};

const microphoneWav = path.join(import.meta.dirname, 'fixtures', 'hello.wav');

export default defineConfig({
  testDir: './tests',
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  timeout: 60_000,
  reporter: 'list',
  use: {
    baseURL: FRONTEND_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['microphone'],
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${microphoneWav}`,
          ],
        },
      },
    },
  ],
  // Fresh servers on every run: reusing one that is already listening could
  // test another worktree's code.
  webServer: [
    {
      name: 'backend',
      // Migrating creates the database on the first run.
      command:
        'pnpm --filter @livekit-platform/backend db:migrate:deploy && pnpm --filter @livekit-platform/backend start',
      url: `${BACKEND_URL}/api/health`,
      env: {
        ...liveKitEnv,
        PORT: '3000',
        DATABASE_URL,
        // A new secret every run: no Auth Token outlives it.
        JWT_SECRET: randomBytes(32).toString('base64url'),
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'agent',
      command: 'pnpm --filter @livekit-platform/agent start',
      url: AGENT_HEALTH_URL,
      // The fake Provider needs no API key and makes no AI calls.
      env: { ...liveKitEnv, AGENT_MODE: 'realtime', REALTIME_PROVIDER: 'fake' },
      // Shows the Agent's Conversation start and end logs in the test output.
      stdout: 'pipe',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      name: 'frontend',
      command: 'pnpm --filter @livekit-platform/frontend dev',
      url: FRONTEND_URL,
      env: { BACKEND_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
