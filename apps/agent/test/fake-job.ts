import {
  type AgentDefinition,
  initializeLogger,
  type ipc,
  JobContext,
  JobProcess,
  runWithJobContextAsync,
  voice,
} from '@livekit/agents';
import { Job, JobType, Room as RoomInfo } from '@livekit/protocol';
import { Room } from '@livekit/rtc-node';
import { vi } from 'vitest';

type LogRecord = Record<string, unknown>;

/** Local inference (VAD, turn detection) is never available to a fake job. */
const noInference: ipc.InferenceExecutor = {
  doInference: () =>
    Promise.reject(new Error('A fake job has no local inference runner')),
};

/**
 * Dispatches an Agent into a room the way the framework's job runner does,
 * but as a fake job without a LiveKit server, like the framework's own
 * console mode: `ctx.connect()` joins nothing, and the room never connects.
 * The Agent's JSON log lines on stdout are captured. `metadata` is the job's
 * metadata, as the dispatch sets it.
 */
export async function dispatchToRoom(
  agent: AgentDefinition,
  roomName: string,
  metadata?: string,
) {
  initializeLogger({ pretty: false, level: 'info' });
  const logLines: string[] = [];
  // Not restored after the job ends: the framework keeps logging for a while
  // after an AgentSession closes. Vitest runs each test file in its own process.
  vi.spyOn(process.stdout, 'write').mockImplementation(
    (chunk: string | Uint8Array) => {
      logLines.push(String(chunk));
      return true;
    },
  );

  let joinedRoom = false;
  const ctx = new JobContext(
    new JobProcess(),
    {
      acceptArguments: {
        name: '',
        identity: 'agent',
        metadata: metadata ?? '',
      },
      job: new Job({
        id: `job-for-${roomName}`,
        type: JobType.JT_ROOM,
        room: new RoomInfo({ name: roomName }),
        metadata,
      }),
      url: '',
      token: '',
      workerId: 'fake-worker',
      fakeJob: true,
    },
    new Room(),
    () => {
      joinedRoom = true;
    },
    () => undefined,
    noInference,
  );
  await runWithJobContextAsync(ctx, () => agent.entry(ctx));

  return {
    /** The Conversation's AgentSession, once the job has started it. */
    session: (): voice.AgentSession | undefined => ctx._primaryAgentSession,
    /** Whether the Agent joined the room it was dispatched to. */
    joinedRoom: () => joinedRoom,
    /** The Agent's structured log records so far, oldest first. */
    logs: (): LogRecord[] =>
      logLines
        .join('')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as LogRecord),
    /**
     * Ends the job. Like the framework's job runner, this closes the
     * Conversation's AgentSession with the `job_shutdown` reason, then runs
     * the job's shutdown callbacks.
     */
    async end(): Promise<void> {
      const session = ctx._primaryAgentSession;
      if (session) {
        const closed = new Promise((resolve) => {
          session.once(voice.AgentSessionEventTypes.Close, resolve);
        });
        session.shutdown({ reason: voice.CloseReason.JOB_SHUTDOWN });
        await closed;
      }
      await Promise.allSettled(
        ctx.shutdownCallbacks.map((callback) => callback()),
      );
    },
  };
}
