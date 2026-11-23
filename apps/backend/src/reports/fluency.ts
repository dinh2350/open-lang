import type { Fluency } from '@open-lang/shared';
import type { TimedTurn, TurnTimes } from './resolve-misses.js';

const FILLER_WORDS = /\b(?:um|uh|er|erm)\b/gi;
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

interface EndedTimes extends TurnTimes {
  readonly endedAt: Date;
}

type EndedTurn = TimedTurn & EndedTimes;

/**
 * A turn with a usable end. A turn that ends before it starts has bad timing
 * and counts as untimed, so it can never make a duration negative.
 */
function isEnded<T extends TurnTimes>(turn: T): turn is T & EndedTimes {
  return turn.endedAt !== null && turn.endedAt >= turn.startedAt;
}

function secondsBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / MILLISECONDS_PER_SECOND;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

function countFillers(text: string): number {
  return text.match(FILLER_WORDS)?.length ?? 0;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Seconds from the earliest start to the latest end, or null with no ended turn. */
function spanSeconds(turns: readonly TurnTimes[]): number | null {
  const starts = turns.map((turn) => turn.startedAt.getTime());
  const ends = turns.filter(isEnded).map((turn) => turn.endedAt.getTime());
  if (starts.length === 0 || ends.length === 0) return null;
  return (Math.max(...ends) - Math.min(...starts)) / MILLISECONDS_PER_SECOND;
}

function wordsPerMinute(
  timedUserTurns: readonly EndedTurn[],
  speakingSeconds: number,
): number | null {
  if (speakingSeconds <= 0) return null;
  const words = sum(timedUserTurns.map((turn) => countWords(turn.text)));
  return words / (speakingSeconds / SECONDS_PER_MINUTE);
}

function talkRatio(
  turns: readonly TimedTurn[],
  speakingSeconds: number,
): number | null {
  const span = spanSeconds(turns.filter(isEnded));
  if (span === null || span <= 0) return null;
  return Math.min(1, speakingSeconds / span);
}

/**
 * How fluently the User spoke. Only timed User turns (those with an end)
 * count towards speed and ratio; the filler count is an estimate from the text.
 */
export function computeFluency(turns: readonly TimedTurn[]): Fluency {
  const userTurns = turns.filter((turn) => turn.role === 'user');
  const timedUserTurns = userTurns.filter(isEnded);
  const durations = timedUserTurns.map((turn) =>
    secondsBetween(turn.startedAt, turn.endedAt),
  );
  const speakingSeconds = sum(durations);
  const hasTimedUser = timedUserTurns.length > 0;

  return {
    wordsPerMinute: hasTimedUser
      ? wordsPerMinute(timedUserTurns, speakingSeconds)
      : null,
    talkRatio: talkRatio(turns, speakingSeconds),
    fillerWordsEstimate: sum(userTurns.map((turn) => countFillers(turn.text))),
    longestTurnSeconds: hasTimedUser ? Math.max(...durations) : null,
  };
}

/** Seconds from the first turn's start to the last turn's end, or null if unknown. */
export function conversationDurationSeconds(
  turns: readonly TurnTimes[],
): number | null {
  return spanSeconds(turns);
}
