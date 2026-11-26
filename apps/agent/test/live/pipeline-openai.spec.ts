// Live tier (`pnpm test:live`): talks to the real OpenAI APIs and costs
// money. Skipped when OPENAI_API_KEY is absent from the environment and from
// apps/agent/.env.
import { describe, expect, it } from 'vitest';
import { liveTutor } from './live-tutor.ts';
import { basicChecks } from './tutor-checks.ts';

describe.skipIf(!process.env.OPENAI_API_KEY)(
  'Agent in Pipeline mode with OpenAI (live)',
  () => {
    const start = liveTutor({ mode: 'pipeline', provider: 'openai' });

    it.each(basicChecks)('$name', async (check) => {
      await expect(check.run(await start())).resolves.toBeUndefined();
    });
  },
);
