import { fluencySchema } from '@open-lang/shared';
import { describe, expect, it } from 'vitest';
import {
  computeFluency,
  conversationDurationSeconds,
} from '../src/reports/fluency.js';
import type { TimedTurn } from '../src/reports/turn-times.js';

const at = (seconds: number): Date =>
  new Date(Date.UTC(2026, 10, 23, 10, 0, seconds));

const turn = (
  role: TimedTurn['role'],
  text: string,
  start: number,
  end: number | null,
): TimedTurn => ({
  role,
  text,
  startedAt: at(start),
  endedAt: end === null ? null : at(end),
});

const words = (count: number): string =>
  Array.from({ length: count }, () => 'word').join(' ');

describe('computeFluency', () => {
  it('a turn that ends before it starts counts as untimed, so the fluency stays valid', () => {
    const turns = [
      turn('agent', 'hi', 0, 4),
      turn('user', words(6), 10, 5),
      turn('user', words(4), 12, 14),
    ];
    const fluency = computeFluency(turns);

    expect(fluencySchema.safeParse(fluency).success).toBe(true);
    expect(fluency).toEqual({
      wordsPerMinute: 120,
      talkRatio: 2 / 14,
      fillerWordsEstimate: 0,
      longestTurnSeconds: 2,
    });
    expect(
      fluencySchema.safeParse(computeFluency([turn('user', words(3), 10, 2)]))
        .success,
    ).toBe(true);
  });

  it("wordsPerMinute is the User's words over the User's timed speaking time", () => {
    const turns = [
      turn('user', words(5), 0, 3),
      turn('agent', words(30), 3, 20),
      turn('user', words(8), 20, 24),
      turn('user', words(7), 30, 35),
    ];

    expect(computeFluency(turns).wordsPerMinute).toBe(100);
  });

  it('is null when no User turn is timed', () => {
    const turns = [
      turn('user', 'hello there', 0, null),
      turn('agent', 'hi', 1, 2),
    ];
    const fluency = computeFluency(turns);

    expect(fluency.wordsPerMinute).toBeNull();
    expect(fluency.longestTurnSeconds).toBeNull();
  });

  it('talkRatio is timed User seconds over the whole span', () => {
    const turns = [
      turn('agent', 'hi', 0, 10),
      turn('user', 'hello', 10, 15),
      turn('agent', 'bye', 15, 20),
    ];

    expect(computeFluency(turns).talkRatio).toBe(0.25);
  });

  it('talkRatio is null when no turn is timed', () => {
    expect(
      computeFluency([turn('user', 'hello', 0, null)]).talkRatio,
    ).toBeNull();
    expect(computeFluency([]).talkRatio).toBeNull();
  });

  it('counts um, uh, er and erm as whole words only', () => {
    const turns = [
      turn('user', 'Um, I think, uh, ERM it is her umbrella. Er yes', 0, 5),
      turn('agent', 'um uh er', 5, 6),
    ];

    expect(computeFluency(turns).fillerWordsEstimate).toBe(4);
  });

  it('longestTurnSeconds is the longest timed User turn', () => {
    const turns = [
      turn('user', 'a', 0, 2),
      turn('agent', 'b', 2, 20),
      turn('user', 'c', 20, 27),
      turn('user', 'd', 30, null),
    ];

    expect(computeFluency(turns).longestTurnSeconds).toBe(7);
  });
});

describe('conversationDurationSeconds', () => {
  it('is the span from the first start to the last end', () => {
    const turns = [turn('agent', 'a', 2, 9), turn('user', 'b', 9, 31)];

    expect(conversationDurationSeconds(turns)).toBe(29);
  });

  it('is null without turns', () => {
    expect(conversationDurationSeconds([])).toBeNull();
  });

  it('is null when no turn has an end', () => {
    expect(
      conversationDurationSeconds([turn('agent', 'a', 2, null)]),
    ).toBeNull();
  });
});
