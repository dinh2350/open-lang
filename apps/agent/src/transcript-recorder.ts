import { log, voice } from '@livekit/agents';
import type { TurnIngest } from '@open-lang/shared';
import type { BackendClient } from './backend-client.ts';

type Role = TurnIngest['role'];

/**
 * How much later than a message's `createdAt` its speaking interval may
 * start. In Pipeline mode an Agent message is stamped when its reply starts,
 * before the language model and the voice have produced the first sound;
 * 5 s covers that delay. In Realtime mode a message is stamped when the
 * speech started, and a User message in Pipeline mode when its turn ended,
 * both at or after the interval's start.
 */
const START_TOLERANCE_MS = 5000;

/**
 * How long `flush` waits for the queue when the job ends. A healthy backend
 * takes milliseconds; 10 s leaves room for a retry or two, and stays well
 * under the 60 s LiveKit gives a job process to shut down.
 */
const FLUSH_TIMEOUT_MS = 10_000;

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
  private unclaimed: SpeakingInterval[] = [];
  private open: SpeakingInterval | undefined;
  private lastClaimed: SpeakingInterval | undefined;

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

  /** When the interval of this role's latest message ended, once it has. */
  get lastClaimedEnd(): number | undefined {
    return this.lastClaimed?.endedAt;
  }

  /** Forgets the unclaimed intervals that ended before `cutoff`. */
  dropEndedBefore(cutoff: number): void {
    this.unclaimed = this.unclaimed.filter(
      ({ endedAt }) => endedAt === undefined || endedAt >= cutoff,
    );
  }

  /**
   * The oldest unclaimed interval, first in, first out, unless it starts
   * too long after the message: then it belongs to a later message.
   */
  claim(createdAt: number): SpeakingInterval | undefined {
    const oldest = this.unclaimed.at(0);
    if (!oldest || oldest.startedAt > createdAt + START_TOLERANCE_MS) {
      return undefined;
    }
    this.unclaimed.shift();
    this.lastClaimed = oldest;
    return oldest;
  }
}

const ROLES: Partial<Record<string, Role>> = {
  user: 'user',
  assistant: 'agent',
};

const OTHER_ROLE: Record<Role, Role> = { user: 'agent', agent: 'user' };

const toIso = (ms: number) => new Date(ms).toISOString();

/** Waits for the transcript's sends. */
export interface TranscriptRecorder {
  /**
   * Ends any open speaking interval now, so its turn gets an endedAt, then
   * waits until every queued send has finished, or for the flush timeout.
   * Never rejects.
   */
  flush(): Promise<void>;
}

/**
 * Sends each user and assistant message once, in order. A message that
 * arrives while its speaking interval is still open is sent again, with the
 * same itemId and its endedAt, when that interval closes; the session's
 * close ends any open interval.
 *
 * Timing: each message takes the oldest unclaimed speaking interval of its
 * role, first in, first out. Two guards keep the pairing in step when an
 * interval gets no message (a cough the server's VAD heard, an untranscribed
 * utterance), which would otherwise shift every later turn by one:
 * - Before a message of one role claims an interval, the unclaimed intervals
 *   of that role that ended before the other role's latest claimed interval
 *   ended are dropped. The other side has spoken and been recorded since, so
 *   those intervals' exchange is over. A message that arrives later than the
 *   other side's whole next turn loses its interval and keeps its own time.
 * - A message never takes an interval that starts more than
 *   START_TOLERANCE_MS after its `createdAt`; that interval stays for the
 *   next message.
 * Without an interval, `startedAt` is the message's `createdAt` and endedAt
 * is omitted.
 */
export function recordTranscript(
  session: voice.AgentSession,
  backend: BackendClient,
  roomName: string,
  options: { flushTimeoutMs?: number } = {},
): TranscriptRecorder {
  const { flushTimeoutMs = FLUSH_TIMEOUT_MS } = options;
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
  const stopAll = (at: number) => {
    intervals.user.stop(at);
    intervals.agent.stop(at);
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
  session.on(voice.AgentSessionEventTypes.Close, ({ createdAt }) => {
    stopAll(createdAt);
  });

  const claimInterval = (role: Role, createdAt: number) => {
    const otherEnd = intervals[OTHER_ROLE[role]].lastClaimedEnd;
    if (otherEnd !== undefined) intervals[role].dropEndedBefore(otherEnd);
    return intervals[role].claim(createdAt);
  };

  session.on(voice.AgentSessionEventTypes.ConversationItemAdded, ({ item }) => {
    if (item.type !== 'message') return;
    const role = ROLES[item.role];
    if (!role) return;
    // A message without text still claims its interval, so the next
    // message pairs with its own.
    const interval = claimInterval(role, item.createdAt);
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

  return {
    async flush() {
      stopAll(Date.now());
      let timer: NodeJS.Timeout | undefined;
      const timedOut = new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          resolve(true);
        }, flushTimeoutMs);
      });
      const gaveUp = await Promise.race([queue.then(() => false), timedOut]);
      clearTimeout(timer);
      if (gaveUp) {
        log().warn({ roomName }, 'Gave up waiting for the transcript to send');
      }
    },
  };
}
