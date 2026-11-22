import { describe, expect, it } from 'vitest';
import {
  conversationReportSchema,
  fluencySchema,
  turnIngestSchema,
} from '../src/conversation-report.ts';

const grammarIssue = {
  said: 'I goes to the office',
  corrected: 'I go to the office',
  reason: 'Use "go" with "I".',
};

const fluency = {
  wordsPerMinute: 110,
  talkRatio: 0.4,
  fillerWordsEstimate: 3,
  longestTurnSeconds: 12,
};

describe('Conversation Report contracts', () => {
  it('caps grammar issues at five', () => {
    const report = (count: number) => ({
      listeningMisses: [],
      grammarIssues: Array.from({ length: count }, () => grammarIssue),
      fluency,
    });

    expect(conversationReportSchema.safeParse(report(5)).success).toBe(true);
    expect(conversationReportSchema.safeParse(report(6)).success).toBe(false);
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

  it('rejects a talkRatio above 1', () => {
    expect(
      fluencySchema.safeParse({ ...fluency, talkRatio: 1.2 }).success,
    ).toBe(false);
  });
});
