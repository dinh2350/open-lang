// Live tier (`pnpm test:live`): talks to the real OpenAI and Google APIs and
// costs money. Each block is skipped when its key is absent from the
// environment and from apps/backend/.env.
import { describe, expect, it } from 'vitest';
import { createLearnerModel } from '../../src/learner/create-learner-model.js';
import type { LearnerJudgeInput } from '../../src/learner/learner-model.js';

const input: LearnerJudgeInput = {
  transcript: [
    { role: 'agent', text: 'Chào bạn! Hôm nay bạn có việc gì cần xử lý?' },
    { role: 'user', text: "I'd like to reschedule the meeting." },
    { role: 'agent', text: 'Được rồi. Còn dự án của bạn thì sao?' },
    { role: 'user', text: 'I want reschedule the deadline' },
    { role: 'agent', text: 'Gần đúng rồi. Ta tiếp tục nhé.' },
  ],
  notes: [],
  items: [
    {
      id: 'i-1',
      english: "I'd like to reschedule the meeting.",
      meaning: 'Tôi muốn dời cuộc họp.',
    },
    {
      id: 'i-2',
      english: 'We need to extend the deadline.',
      meaning: 'Chúng ta cần gia hạn thời hạn.',
    },
  ],
};

const providers = [
  { provider: 'openai', keyName: 'OPENAI_API_KEY' },
  { provider: 'google', keyName: 'GOOGLE_API_KEY' },
] as const;

describe.each(providers)('The $provider learner model (live)', (target) => {
  it.skipIf(!process.env[target.keyName])(
    'judges an item the User used on their own as recalled, and names only the items it was given',
    async () => {
      const model = createLearnerModel({
        // The Provider's default model: one LEARNER_MODEL cannot suit both.
        LEARNER_MODEL: undefined,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        LEARNER_PROVIDER: target.provider,
      });

      const { matches, outcomes } = await model.judge(input);

      const known = new Set(input.items.map((item) => item.id));
      for (const { itemId } of [...matches, ...outcomes]) {
        expect(known).toContain(itemId);
      }
      expect(outcomes).toContainEqual({ itemId: 'i-1', outcome: 'recalled' });
    },
  );
});
