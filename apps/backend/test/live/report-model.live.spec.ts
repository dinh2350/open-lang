// Live tier (`pnpm test:live`): talks to the real OpenAI and Google APIs and
// costs money. Each block is skipped when its key is absent from the
// environment and from apps/backend/.env.
import { ASSESSMENT_LIMITS } from '@open-lang/shared';
import { describe, expect, it } from 'vitest';
import { createReportModel } from '../../src/reports/create-report-model.js';
import type { ReportInput } from '../../src/reports/report-model.js';

const input: ReportInput = {
  transcript: [
    { role: 'agent', text: 'Chào bạn! Hôm nay bạn muốn học gì?' },
    { role: 'user', text: 'Mình muốn học cách báo cáo công việc.' },
    {
      role: 'agent',
      text: 'Hay đó. Bạn thử nói câu này nhé: Yesterday I finished the report.',
    },
    { role: 'user', text: 'No blocker. I finish the report yesterday.' },
    {
      role: 'agent',
      text: 'Gần đúng rồi. Nói là: I finished the report yesterday.',
    },
    { role: 'user', text: 'I finished the report yesterday.' },
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
    'the Report model answers within the assessment limits',
    async () => {
      const model = createReportModel({
        // The Provider's default model: one REPORT_MODEL cannot suit both.
        REPORT_MODEL: undefined,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        REPORT_PROVIDER: target.provider,
      });

      const { assessment } = await model.draft(input);

      // The draft, before `composeReport` would cut it: the prompt alone has
      // to keep the model within the limits.
      expect(assessment.overview).not.toBe('');
      expect(assessment.overview.length).toBeLessThanOrEqual(
        ASSESSMENT_LIMITS.overviewLength,
      );
      expect(assessment.strengths.length).toBeLessThanOrEqual(
        ASSESSMENT_LIMITS.strengths,
      );
      expect(assessment.improvements.length).toBeLessThanOrEqual(
        ASSESSMENT_LIMITS.improvements,
      );
      for (const item of [
        ...assessment.strengths,
        ...assessment.improvements,
      ]) {
        expect(item.length).toBeLessThanOrEqual(ASSESSMENT_LIMITS.itemLength);
      }
    },
  );
});
