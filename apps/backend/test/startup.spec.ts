import { afterEach, describe, expect, it, vi } from 'vitest';
import { startTestApp, testEnv } from './support/test-app.js';

describe('Backend startup', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.keys(testEnv))(
    'refuses to start, naming %s, when it is missing',
    async (name) => {
      await expect(startTestApp({ [name]: undefined })).rejects.toThrow(
        new RegExp(name),
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

  it('refuses a blank JWT_SECRET, as .env.example leaves it', async () => {
    await expect(startTestApp({ JWT_SECRET: '' })).rejects.toThrow(
      /JWT_SECRET/,
    );
  });

  it('refuses an AGENT_API_KEY shorter than 32 characters', async () => {
    await expect(
      startTestApp({ AGENT_API_KEY: 'x'.repeat(31) }),
    ).rejects.toThrow(/AGENT_API_KEY/);
  });

  it('refuses a DATABASE_URL that is not a Postgres URL', async () => {
    await expect(
      startTestApp({ DATABASE_URL: 'mysql://localhost/open_lang' }),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  it('refuses a PORT that is not a number', async () => {
    await expect(startTestApp({ PORT: 'abc' })).rejects.toThrow(/PORT/);
  });
});
