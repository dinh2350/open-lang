// Live tier (`pnpm test:live`): talks to the real OpenAI and Google APIs and
// costs money. Each block is skipped when its key is absent from the
// environment and from apps/backend/.env.
import { describe, expect, it } from 'vitest';
import { createReportModel } from '../../src/reports/create-report-model.js';
import type { ReportInput } from '../../src/reports/report-model.js';

const input: ReportInput = {
  transcript: [
    { role: 'agent', text: 'Morning! Any blockers I should loop in on?' },
    { role: 'user', text: 'No blocker. I finish the report yesterday.' },
  ],
  notes: [
    {
      kind: 'correction',
      english: 'I finished the report yesterday.',
      meaning: 'Dùng thì quá khứ với yesterday.',
      said: 'I finish the report yesterday.',
    },
  ],
};

const providers = [
  { provider: 'openai', keyName: 'OPENAI_API_KEY' },
  { provider: 'google', keyName: 'GOOGLE_API_KEY' },
] as const;

describe.each(providers)('The $provider report model (live)', (target) => {
  it.skipIf(!process.env[target.keyName])(
    'drafts a two-turn transcript',
    async () => {
      const model = createReportModel({
        // The Provider's default model: one REPORT_MODEL cannot suit both.
        REPORT_MODEL: undefined,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        REPORT_PROVIDER: target.provider,
      });

      const draft = await model.draft(input);

      expect(draft.assessment.overview).not.toBe('');
      expect(Array.isArray(draft.assessment.strengths)).toBe(true);
      expect(Array.isArray(draft.assessment.improvements)).toBe(true);
    },
  );
});
