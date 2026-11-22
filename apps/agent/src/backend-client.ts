import { setTimeout as sleep } from 'node:timers/promises';
import { log } from '@livekit/agents';
import type { MissIngest, TurnIngest } from '@open-lang/shared';

/** Sends what happens in a Conversation to the backend, which stores it. */
export interface BackendClient {
  sendTurn(roomName: string, turn: TurnIngest): Promise<void>;
  sendMiss(roomName: string, miss: MissIngest): Promise<void>;
}

const ATTEMPTS = 3;
/** A backend that hangs must not hold up the transcript's queue for long. */
const REQUEST_TIMEOUT_MS = 5000;

/** Whether one POST succeeded, and the HTTP status, if there was a response. */
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
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
    route: 'turns' | 'misses',
    body: TurnIngest | MissIngest,
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
  };
}
