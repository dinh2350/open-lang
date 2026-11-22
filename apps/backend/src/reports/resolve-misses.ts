/** Who spoke a turn of a Conversation. */
export type Role = 'agent' | 'user';

export interface TurnTimes {
  readonly role: Role;
  readonly startedAt: Date;
  readonly endedAt: Date | null;
}

export interface TimedTurn extends TurnTimes {
  readonly text: string;
}

function isPlayingAt(turn: TurnTimes, pressedAt: Date): boolean {
  return (
    turn.endedAt !== null &&
    turn.startedAt <= pressedAt &&
    pressedAt <= turn.endedAt
  );
}

function resolveMiss(
  turns: readonly TurnTimes[],
  pressedAt: Date,
): number | null {
  let playing: number | null = null;
  let latestStarted: number | null = null;

  for (const [index, turn] of turns.entries()) {
    if (turn.role !== 'agent') continue;
    if (isPlayingAt(turn, pressedAt)) playing = index;
    if (turn.startedAt <= pressedAt) latestStarted = index;
  }

  return playing ?? latestStarted;
}

/** Turns must be sorted by startedAt. Returns distinct indexes into `turns`, ascending. */
export function resolveMisses(
  turns: readonly TurnTimes[],
  pressedAt: readonly Date[],
): number[] {
  const missed = new Set<number>();

  for (const press of pressedAt) {
    const index = resolveMiss(turns, press);
    if (index !== null) missed.add(index);
  }

  return [...missed].sort((a, b) => a - b);
}
