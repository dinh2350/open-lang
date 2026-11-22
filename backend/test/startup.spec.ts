import { afterEach, describe, expect, it, vi } from 'vitest';
import { startTestApp, type testEnv } from './support/test-app.js';

const settingsNamedInErrors: Record<keyof typeof testEnv, string> = {
  LIVEKIT_URL: 'LiveKit',
  LIVEKIT_API_KEY: 'LiveKit',
  LIVEKIT_API_SECRET: 'LiveKit',
  AGENT_NAME: 'LiveKit',
  JWT_SECRET: 'Auth',
  DATABASE_URL: 'database',
};

describe('Backend startup', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.entries(settingsNamedInErrors))(
    'refuses to start, naming %s, when it is missing',
    async (name, settings) => {
      await expect(startTestApp({ [name]: undefined })).rejects.toThrow(
        new RegExp(`Invalid ${settings} settings[\\s\\S]*${name}`),
      );
    },
  );

  it('refuses a LIVEKIT_URL that is not a WebSocket URL', async () => {
    await expect(
      startTestApp({ LIVEKIT_URL: 'https://livekit.test' }),
    ).rejects.toThrow(/LIVEKIT_URL/);
  });

  it('refuses a JWT_SECRET shorter than 32 characters', async () => {
    await expect(startTestApp({ JWT_SECRET: 'x'.repeat(31) })).rejects.toThrow(
      /JWT_SECRET/,
    );
  });

  it('refuses a DATABASE_URL that is not a Postgres URL', async () => {
    await expect(
      startTestApp({ DATABASE_URL: 'mysql://localhost/open_live_agent' }),
    ).rejects.toThrow(/DATABASE_URL/);
  });
});
