// Live tier (`pnpm test:live`): talks to the real OpenAI Realtime API and
// costs money. Skipped when OPENAI_API_KEY is absent from the environment
// and from apps/agent/.env. The checks judge what the tutor does, not its
// exact words.
import { describe, expect, it } from 'vitest';
import { liveTutor } from './live-tutor.ts';
import {
  basicChecks,
  learnerBriefChecks,
  repeatingChecks,
} from './tutor-checks.ts';

describe.skipIf(!process.env.OPENAI_API_KEY)(
  'Agent in Realtime mode with OpenAI (live)',
  () => {
    const start = liveTutor({ mode: 'realtime', provider: 'openai' });

    it.each([...basicChecks, ...repeatingChecks, ...learnerBriefChecks])(
      '$name',
      async (check) => {
        await expect(
          check.run(await start(check.brief)),
        ).resolves.toBeUndefined();
      },
    );
  },
);
