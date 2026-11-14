import { afterEach, describe, expect, it, vi } from 'vitest';
import { startTestApp, testEnv } from './test-app.js';

describe('Backend startup', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.keys(testEnv))(
    'refuses to start, naming %s, when it is missing',
    async (name) => {
      await expect(startTestApp({ [name]: undefined })).rejects.toThrow(
        new RegExp(`Invalid LiveKit settings[\\s\\S]*${name}`),
      );
    },
  );

  it('refuses a LIVEKIT_URL that is not a WebSocket URL', async () => {
    await expect(
      startTestApp({ LIVEKIT_URL: 'https://livekit.test' }),
    ).rejects.toThrow(/LIVEKIT_URL/);
  });
});
