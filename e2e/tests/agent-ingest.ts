import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

/** Where the backend that playwright.config.ts starts listens. */
const BACKEND_URL = 'http://localhost:3000';

/** One finished turn, as the Agent reports it. */
export interface PostedTurn {
  readonly role: 'agent' | 'user';
  readonly text: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
}

/** The run's Agent key, which playwright.config.ts shares with the backend. */
function agentApiKey(): string {
  const key = process.env.E2E_AGENT_API_KEY;
  if (key === undefined) {
    throw new Error(
      'E2E_AGENT_API_KEY is not set; playwright.config.ts sets it.',
    );
  }
  return key;
}

/** The `video.room` claim of a LiveKit Room Token: the Conversation's room. */
export function roomNameOfToken(jwt: string): string {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('The Room Token is not a JWT.');
  }
  const [, payload] = parts;
  const claims: unknown = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  );
  if (
    typeof claims === 'object' &&
    claims !== null &&
    'video' in claims &&
    typeof claims.video === 'object' &&
    claims.video !== null &&
    'room' in claims.video &&
    typeof claims.video.room === 'string'
  ) {
    return claims.video.room;
  }
  throw new Error('The Room Token names no room.');
}

/**
 * Waits for the Room Token the page gets once Bắt đầu is pressed, and gives
 * the room it names. Start waiting before pressing Bắt đầu.
 */
export async function roomNameOfNextConversation(page: Page): Promise<string> {
  const response = await page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith('/api/token') &&
      candidate.request().method() === 'POST' &&
      candidate.ok(),
  );
  const body: unknown = await response.json();
  if (
    typeof body === 'object' &&
    body !== null &&
    'participant_token' in body &&
    typeof body.participant_token === 'string'
  ) {
    return roomNameOfToken(body.participant_token);
  }
  throw new Error('The Room Token response has no participant_token.');
}

async function postToAgentIngest(
  roomName: string,
  path: 'turns' | 'misses',
  body: object,
): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/api/agent/conversations/${encodeURIComponent(roomName)}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agentApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (response.status !== 204) {
    throw new Error(
      `POST ${path} for ${roomName} answered ${String(response.status)}: ${await response.text()}`,
    );
  }
}

/** Records a turn of the Conversation in `roomName`, as the Agent would. */
export async function postTurn(
  roomName: string,
  turn: PostedTurn,
): Promise<void> {
  await postToAgentIngest(roomName, 'turns', {
    itemId: randomUUID(),
    role: turn.role,
    text: turn.text,
    startedAt: turn.startedAt.toISOString(),
    endedAt: turn.endedAt.toISOString(),
  });
}

/** Records a press of "Chưa nghe kịp" at `pressedAt`, as the Agent would. */
export async function postMiss(
  roomName: string,
  pressedAt: Date,
): Promise<void> {
  await postToAgentIngest(roomName, 'misses', {
    pressedAt: pressedAt.toISOString(),
  });
}

/** A moment `seconds` before now. */
export function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}
