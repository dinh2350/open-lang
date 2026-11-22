import { log, voice } from '@livekit/agents';
import type { TurnIngest } from '@open-lang/shared';
import type { BackendClient } from './backend-client.ts';

type Role = TurnIngest['role'];

/**
 * A time one side spent speaking, from LiveKit's state events, in
 * milliseconds since the epoch (the Node.js SDK's unit for `createdAt`).
 */
interface SpeakingInterval {
  startedAt: number;
  endedAt?: number;
  /** Called once the interval closes, if a message has claimed it by then. */
  onClose?: (endedAt: number) => void;
}

/** The speaking intervals of one role, oldest first. */
class SpeakingIntervals {
  private readonly unclaimed: SpeakingInterval[] = [];
  private open: SpeakingInterval | undefined;

  start(at: number): void {
    this.open = { startedAt: at };
    this.unclaimed.push(this.open);
  }

  stop(at: number): void {
    const interval = this.open;
    if (!interval) return;
    this.open = undefined;
    interval.endedAt = at;
    interval.onClose?.(at);
  }

  /** The oldest interval no message has claimed yet, first in, first out. */
  claim(): SpeakingInterval | undefined {
    return this.unclaimed.shift();
  }
}

const ROLES: Partial<Record<string, Role>> = {
  user: 'user',
  assistant: 'agent',
};

const toIso = (ms: number) => new Date(ms).toISOString();

/**
 * Sends each user and assistant message once, in order. A message that
 * arrives while its speaking interval is still open is sent again, with the
 * same itemId and its endedAt, when that interval closes.
 */
export function recordTranscript(
  session: voice.AgentSession,
  backend: BackendClient,
  roomName: string,
): void {
  const intervals: Record<Role, SpeakingIntervals> = {
    user: new SpeakingIntervals(),
    agent: new SpeakingIntervals(),
  };
  // One queue: the backend gets the turns in order, one at a time, so it
  // never sees two posts of the same itemId at once.
  let queue: Promise<void> = Promise.resolve();
  const send = (turn: TurnIngest) => {
    queue = queue
      .then(() => backend.sendTurn(roomName, turn))
      .catch(() => {
        log().warn({ roomName }, 'Could not send a turn to the backend');
      });
  };

  const followState = (
    role: Role,
    {
      oldState,
      newState,
      createdAt,
    }: { oldState: string; newState: string; createdAt: number },
  ) => {
    if (newState === 'speaking') intervals[role].start(createdAt);
    else if (oldState === 'speaking') intervals[role].stop(createdAt);
  };
  session.on(voice.AgentSessionEventTypes.UserStateChanged, (event) => {
    followState('user', event);
  });
  session.on(voice.AgentSessionEventTypes.AgentStateChanged, (event) => {
    followState('agent', event);
  });

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, ({ item }) => {
    if (item.type !== 'message') return;
    const role = ROLES[item.role];
    if (!role) return;
    // A message without text still claims its interval, so the next
    // message pairs with its own.
    const interval = intervals[role].claim();
    const text = item.textContent?.trim();
    if (!text) return;

    const turn: TurnIngest = {
      itemId: item.id,
      role,
      text,
      startedAt: toIso(interval?.startedAt ?? item.createdAt),
    };
    if (interval?.endedAt !== undefined) {
      send({ ...turn, endedAt: toIso(interval.endedAt) });
      return;
    }
    send(turn);
    if (interval) {
      interval.onClose = (endedAt) => {
        send({ ...turn, endedAt: toIso(endedAt) });
      };
    }
  });
}
