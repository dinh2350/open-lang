import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  newSchedule,
  normalizeKey,
  statusOf,
} from '../src/learner/spacing.js';

const DAY = 86_400_000;
const at = (days: number) => new Date(Date.UTC(2026, 10, 23) + days * DAY);
const schedule = (intervalDays: number, dueDay: number) => ({
  intervalDays,
  dueAt: at(dueDay),
});

describe('learner spacing', () => {
  it('newSchedule gives a 1-day interval due a day later', () => {
    expect(newSchedule(at(0))).toEqual(schedule(1, 1));
  });

  it.each([
    [
      'a recall once due doubles the interval',
      schedule(2, 3),
      'recalled',
      at(3),
      schedule(4, 7),
      'grew',
    ],
    [
      'a late recall doubles from the recall time',
      schedule(2, 3),
      'recalled',
      at(5),
      schedule(4, 9),
      'grew',
    ],
    [
      'an early recall changes nothing',
      schedule(2, 3),
      'recalled',
      at(2),
      schedule(2, 3),
      'early',
    ],
    [
      'a miss resets to one day',
      schedule(8, 15),
      'missed',
      at(20),
      schedule(1, 21),
      'reset',
    ],
  ] as const)(
    'applyOutcome: %s',
    (_name, before, outcome, when, after, effect) => {
      expect(applyOutcome(before, outcome, when)).toEqual({
        schedule: after,
        effect,
      });
    },
  );

  it('applyOutcome does not change the schedule it is given', () => {
    const before = schedule(2, 3);
    const dueAt = before.dueAt.getTime();

    applyOutcome(before, 'recalled', at(5));
    applyOutcome(before, 'missed', at(5));

    expect(before.intervalDays).toBe(2);
    expect(before.dueAt.getTime()).toBe(dueAt);
  });

  it('reaches mastered after three due recalls', () => {
    let s = newSchedule(at(0));
    for (const day of [1, 3, 7])
      s = applyOutcome(s, 'recalled', at(day)).schedule;
    expect(s.intervalDays).toBe(8);
    expect(statusOf(s, at(7))).toBe('mastered');
    expect(statusOf(schedule(4, 7), at(7))).toBe('learning');
  });

  it('statusOf: 7 days is mastered and 6 is learning', () => {
    expect(statusOf(schedule(7, 10), at(10))).toBe('mastered');
    expect(statusOf(schedule(6, 10), at(10))).toBe('learning');
  });

  it('statusOf: a mastered item neglected for more than one interval is learning again', () => {
    expect(statusOf(schedule(8, 15), at(23))).toBe('mastered');
    expect(statusOf(schedule(8, 15), new Date(at(23).getTime() + 1))).toBe(
      'learning',
    );
  });

  it.each([
    [
      "  I'd like to Reschedule the meeting. ",
      "i'd like to reschedule the meeting",
    ],
    ['Deadline!', 'deadline'],
    ['a   b\nc', 'a b c'],
    ['Hello, world ... ', 'hello, world'],
    ['Really?!', 'really'],
    [
      'I’d like to reschedule the meeting',
      "i'd like to reschedule the meeting",
    ],
    [
      "I'd like to reschedule the meeting.",
      "i'd like to reschedule the meeting",
    ],
    ['“Deadline”', 'deadline'],
    ['"Deadline."', 'deadline'],
    ["'agenda'", 'agenda'],
    ['wait…', 'wait'],
    ['as follows:', 'as follows'],
    ['see you then;', 'see you then'],
    ['Don’t worry', "don't worry"],
    ['Ａgenda', 'agenda'],
    ['?!… "', ''],
  ])('normalizeKey(%j) is %j', (english, key) => {
    expect(normalizeKey(english)).toBe(key);
  });
});
