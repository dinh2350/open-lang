import { describe, expect, it } from 'vitest';
import {
  LEARNER_BRIEF_LIMITS,
  parseLearnerBrief,
} from '../src/learner-brief.ts';

const item = {
  english: "I'd like to reschedule the meeting.",
  meaning: 'Tôi muốn dời cuộc họp.',
  status: 'learning' as const,
};

describe('Learner brief contract', () => {
  it('parses a valid brief', () => {
    const brief = { version: 1, items: [item] };
    expect(parseLearnerBrief(JSON.stringify(brief))).toEqual(brief);
  });

  it('accepts the most items, the longest texts and a mastered item', () => {
    const longest = {
      english: 'x'.repeat(120),
      meaning: 'y'.repeat(120),
      status: 'mastered' as const,
    };
    const brief = {
      version: 1,
      items: Array.from({ length: 40 }, () => longest),
    };
    expect(parseLearnerBrief(JSON.stringify(brief))).toEqual(brief);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['text that is not JSON', 'nope'],
    ['another version', JSON.stringify({ version: 2, items: [] })],
    [
      '41 items',
      JSON.stringify({
        version: 1,
        items: Array.from({ length: 41 }, () => item),
      }),
    ],
    [
      'an english over 120 characters',
      JSON.stringify({
        version: 1,
        items: [{ ...item, english: 'x'.repeat(121) }],
      }),
    ],
    [
      'an unknown status',
      JSON.stringify({ version: 1, items: [{ ...item, status: 'known' }] }),
    ],
  ])('returns null for bad metadata: %s', (_name, metadata) => {
    expect(parseLearnerBrief(metadata)).toBeNull();
  });

  it('fixes the limits of the spec', () => {
    expect(LEARNER_BRIEF_LIMITS).toEqual({ items: 40, bytes: 4096 });
  });
});
