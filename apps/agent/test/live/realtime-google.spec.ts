// Live tier (`pnpm test:live`): talks to the real Gemini Live API and costs
// money. Skipped unless the environment or apps/agent/.env has Google
// credentials: GOOGLE_API_KEY, or Vertex AI through GOOGLE_GENAI_USE_VERTEXAI.
import { describe, expect, it } from 'vitest';
import { hasGoogleCredentials } from './google-credentials.ts';
import { liveTutor } from './live-tutor.ts';
import { basicChecks, learnerBriefChecks } from './tutor-checks.ts';

describe.skipIf(!hasGoogleCredentials(process.env))(
  'Agent in Realtime mode with Google (live)',
  () => {
    const start = liveTutor({ mode: 'realtime', provider: 'google' });

    it.each([...basicChecks, ...learnerBriefChecks])('$name', async (check) => {
      await expect(
        check.run(await start(check.brief)),
      ).resolves.toBeUndefined();
    });
  },
);
