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
