import { describe, expect, it } from 'vitest';
import {
  ASSESSMENT_LIMITS,
  assessmentSchema,
  conversationReportSchema,
  fluencySchema,
  turnIngestSchema,
} from '../src/conversation-report.ts';

const fluency = {
  wordsPerMinute: 110,
  talkRatio: 0.4,
  fillerWordsEstimate: 3,
  longestTurnSeconds: 12,
};

describe('Conversation Report contracts', () => {
  it('assessmentSchema refuses an overview over 160 characters, three strengths, or four improvements', () => {
    const assessment = {
      overview: 'a'.repeat(160),
      strengths: ['b'.repeat(90), 'c'],
      improvements: ['d', 'e', 'f'.repeat(90)],
    };

    expect(ASSESSMENT_LIMITS).toEqual({
      overviewLength: 160,
      itemLength: 90,
      strengths: 2,
      improvements: 3,
    });
    expect(assessmentSchema.safeParse(assessment).success).toBe(true);
    expect(
      assessmentSchema.safeParse({ ...assessment, overview: 'a'.repeat(161) })
        .success,
    ).toBe(false);
    expect(
      assessmentSchema.safeParse({
        ...assessment,
        strengths: ['b', 'c', 'd'],
      }).success,
    ).toBe(false);
    expect(
      assessmentSchema.safeParse({
        ...assessment,
        improvements: ['d', 'e', 'f', 'g'],
      }).success,
    ).toBe(false);
    expect(
      assessmentSchema.safeParse({
        ...assessment,
        strengths: ['b'.repeat(91)],
      }).success,
    ).toBe(false);
  });

  it('a Report is the assessment and the fluency, and nothing of the old shape', () => {
    const assessment = { overview: '', strengths: [], improvements: [] };

    expect(
      conversationReportSchema.safeParse({ assessment, fluency }).success,
    ).toBe(true);
    expect(
      conversationReportSchema.safeParse({
        listeningMisses: [],
        grammarIssues: [],
        fluency,
      }).success,
    ).toBe(false);
  });

  it('allows null fluency numbers but requires every field', () => {
    expect(
      fluencySchema.safeParse({
        wordsPerMinute: null,
        talkRatio: null,
        fillerWordsEstimate: 0,
        longestTurnSeconds: null,
      }).success,
    ).toBe(true);
    expect(
      fluencySchema.safeParse({
        wordsPerMinute: null,
        talkRatio: null,
        longestTurnSeconds: null,
      }).success,
    ).toBe(false);
  });

  it('turn ingest needs a non-empty text and an ISO startedAt', () => {
    const turn = {
      itemId: 'item-1',
      role: 'user',
      text: 'Hello there',
      startedAt: '2026-11-23T09:00:00.000Z',
    };

    expect(turnIngestSchema.safeParse(turn).success).toBe(true);
    expect(turnIngestSchema.safeParse({ ...turn, text: '' }).success).toBe(
      false,
    );
    expect(
      turnIngestSchema.safeParse({ ...turn, startedAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it('rejects a turn that ends before it starts', () => {
    const turn = {
      itemId: 'item-1',
      role: 'user',
      text: 'Hello there',
      startedAt: '2026-11-23T09:00:05.000Z',
    };

    const reversed = turnIngestSchema.safeParse({
      ...turn,
      endedAt: '2026-11-23T09:00:04.999Z',
    });

    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues).toEqual([
      expect.objectContaining({
        path: ['endedAt'],
        message: 'endedAt must be at or after startedAt.',
      }),
    ]);
    expect(
      turnIngestSchema.safeParse({ ...turn, endedAt: turn.startedAt }).success,
    ).toBe(true);
  });

  it('rejects a talkRatio above 1', () => {
    expect(
      fluencySchema.safeParse({ ...fluency, talkRatio: 1.2 }).success,
    ).toBe(false);
  });
});
