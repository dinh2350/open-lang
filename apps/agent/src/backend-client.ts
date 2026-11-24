import { setTimeout as sleep } from 'node:timers/promises';
import { log } from '@livekit/agents';
import type { MissIngest, Note, TurnIngest } from '@open-lang/shared';

/** Sends what happens in a Conversation to the backend, which stores it. */
export interface BackendClient {
  sendTurn(roomName: string, turn: TurnIngest): Promise<void>;
  sendMiss(roomName: string, miss: MissIngest): Promise<void>;
  sendNote(roomName: string, note: Note): Promise<void>;
  /**
   * The end marker: every turn and Note of the Conversation has been sent,
   * so its Report may be written.
   */
  sendEnd(roomName: string): Promise<void>;
}

const ATTEMPTS = 3;
/** A backend that hangs must not hold up the transcript's queue for long. */
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Whether one POST succeeded, and the HTTP status, if there was a response.
 * Without a body, the POST sends none.
 */
async function postOnce(
  url: URL,
  agentApiKey: string,
  body: unknown,
): Promise<{ ok: boolean; status?: number }> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agentApiKey}`,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    // The backend is unreachable or too slow. The error is not logged: it
    // could carry the request.
    return { ok: false };
  }
}

/** Never rejects: 3 attempts (retryDelayMs apart, default 300), then logs a warning and resolves. */
export function createBackendClient(options: {
  backendUrl: string;
  agentApiKey: string;
  retryDelayMs?: number;
}): BackendClient {
  const { backendUrl, agentApiKey, retryDelayMs = 300 } = options;

  async function post(
    roomName: string,
    route: 'turns' | 'misses' | 'notes' | 'end',
    body?: TurnIngest | MissIngest | Note,
  ): Promise<void> {
    const url = new URL(
      `/api/agent/conversations/${encodeURIComponent(roomName)}/${route}`,
      backendUrl,
    );
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const { ok, status } = await postOnce(url, agentApiKey, body);
      if (ok) return;
      // Only the room, the status and the attempt: never the key or the text.
      log().warn(
        { roomName, route, status, attempt },
        attempt < ATTEMPTS
          ? 'Backend request failed, retrying'
          : 'Backend request failed, giving up',
      );
      if (attempt < ATTEMPTS) await sleep(retryDelayMs);
    }
  }

  return {
    sendTurn: (roomName, turn) => post(roomName, 'turns', turn),
    sendMiss: (roomName, miss) => post(roomName, 'misses', miss),
    sendNote: (roomName, note) => post(roomName, 'notes', note),
    sendEnd: (roomName) => post(roomName, 'end'),
  };
}

/**
 * A client that keeps track of the sends it has started, so the job can wait
 * for them before it posts the end marker. `settled()` resolves once every
 * send started so far has finished; the sends never reject.
 */
export function trackPendingSends(backend: BackendClient): {
  client: BackendClient;
  settled(): Promise<void>;
} {
  const pending = new Set<Promise<void>>();
  const track = (send: Promise<void>): Promise<void> => {
    pending.add(send);
    const forget = () => {
      pending.delete(send);
    };
    void send.then(forget, forget);
    return send;
  };
  return {
    client: {
      sendTurn: (roomName, turn) => track(backend.sendTurn(roomName, turn)),
      sendMiss: (roomName, miss) => track(backend.sendMiss(roomName, miss)),
      sendNote: (roomName, note) => track(backend.sendNote(roomName, note)),
      sendEnd: (roomName) => track(backend.sendEnd(roomName)),
    },
    async settled() {
      await Promise.allSettled([...pending]);
    },
  };
}
