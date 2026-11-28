import type { LearnerItemStatus } from '@open-lang/shared';

/** The interval of an item the tutor has just taught, or has just been missed. */
export const FIRST_INTERVAL_DAYS = 1;
/** A recall of a due item multiplies its interval by this. */
export const INTERVAL_GROWTH_FACTOR = 2;
/** An item with an interval of this many days or more is mastered. */
export const MASTERED_INTERVAL_DAYS = 7;

const MILLISECONDS_PER_DAY = 86_400_000;
/** Quotes around an item, which carry no part of it. */
const QUOTES = ['"', "'"];
/** What may come before an item and carries no part of it. */
const LEADING_NOISE = new Set([' ', ...QUOTES]);
/**
 * What may come after an item and carries no part of it: what ends a
 * sentence or a clause, and closing quotes. NFKC has already turned `…` into
 * three dots.
 */
const TRAILING_NOISE = new Set([' ', '.', '!', '?', ',', ';', ':', ...QUOTES]);

/** When an item is next due, and how far apart its reviews are now. */
export interface Schedule {
  readonly intervalDays: number;
  readonly dueAt: Date;
}

export type Outcome = 'recalled' | 'missed';

/**
 * What an outcome did to a schedule: `grew` when a due item was recalled,
 * `early` when it was recalled before it was due (nothing changes), `reset`
 * when it was missed.
 */
export type OutcomeEffect = 'grew' | 'early' | 'reset';

function scheduleFrom(at: Date, intervalDays: number): Schedule {
  return {
    intervalDays,
    dueAt: new Date(at.getTime() + intervalDays * MILLISECONDS_PER_DAY),
  };
}

/**
 * The key two spellings of the same English item share: Unicode forms,
 * typographic quotes, case, runs of whitespace, surrounding quotes and the
 * punctuation that ends a sentence do not tell items apart. Punctuation
 * inside the item stays. Notes are written by models, which mix `’` and `'`.
 */
export function normalizeKey(english: string): string {
  const spaced = english
    .normalize('NFKC')
    .replaceAll(/[‘’]/g, "'")
    .replaceAll(/[“”]/g, '"')
    .toLowerCase()
    .replaceAll(/\s+/g, ' ');
  let end = spaced.length;
  while (end > 0 && TRAILING_NOISE.has(spaced.charAt(end - 1))) end--;
  let start = 0;
  while (start < end && LEADING_NOISE.has(spaced.charAt(start))) start++;
  return spaced.slice(start, end);
}

export function newSchedule(at: Date): Schedule {
  return scheduleFrom(at, FIRST_INTERVAL_DAYS);
}

/**
 * The schedule after the tutor judged the User's recall at `at`. A recall once
 * the item is due grows the interval from `at`, a recall before that changes
 * nothing, and a miss starts over. Never changes the schedule it is given.
 */
export function applyOutcome(
  schedule: Schedule,
  outcome: Outcome,
  at: Date,
): { schedule: Schedule; effect: OutcomeEffect } {
  if (outcome === 'missed') {
    return { schedule: newSchedule(at), effect: 'reset' };
  }
  if (at < schedule.dueAt) {
    return { schedule, effect: 'early' };
  }
  return {
    schedule: scheduleFrom(at, schedule.intervalDays * INTERVAL_GROWTH_FACTOR),
    effect: 'grew',
  };
}

/**
 * Mastered means a long interval that the User has not let lapse: an item
 * overdue by more than one whole interval is learning again.
 */
export function statusOf(schedule: Schedule, now: Date): LearnerItemStatus {
  const overdueMs = now.getTime() - schedule.dueAt.getTime();
  const lapsed = overdueMs > schedule.intervalDays * MILLISECONDS_PER_DAY;
  return schedule.intervalDays >= MASTERED_INTERVAL_DAYS && !lapsed
    ? 'mastered'
    : 'learning';
}
