import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';

/** Where the backend that playwright.config.ts starts listens. */
export const BACKEND_URL = 'http://localhost:3000';

/** One finished turn, as the Agent reports it. */
export interface PostedTurn {
  readonly role: 'agent' | 'user';
  readonly text: string;
  readonly startedAt: Date;
  readonly endedAt: Date;
}

/**
 * A Note the tutor writes down, as the Agent reports it. `said`, what the
 * Member said, is there for a correction only; the other kinds have null.
 */
export type PostedNote =
  | {
      readonly kind: 'phrase' | 'word' | 'missed';
      readonly english: string;
      readonly meaning: string;
      readonly said: null;
    }
  | {
      readonly kind: 'correction';
      readonly english: string;
      readonly meaning: string;
      readonly said: string;
    };

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The claims a LiveKit Room Token carries, read without checking its signature. */
function claimsOfToken(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('The Room Token is not a JWT.');
  }
  const [, payload] = parts;
  const claims: unknown = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  );
  if (!isRecord(claims)) {
    throw new Error('The Room Token has no claims.');
  }
  return claims;
}

/** The `video.room` claim of a LiveKit Room Token: the Conversation's room. */
export function roomNameOfToken(jwt: string): string {
  const { video } = claimsOfToken(jwt);
  if (isRecord(video) && typeof video.room === 'string') {
    return video.room;
  }
  throw new Error('The Room Token names no room.');
}

/**
 * The metadata of the Agent dispatch the Room Token carries
 * (`roomConfig.agents[0].metadata`): where the backend puts the learner
 * brief. Undefined when the dispatch has none, which a decoded token shows as
 * a missing claim or as an empty string. Throws when the token dispatches no
 * Agent at all, so a token that is not the backend's cannot pass for one
 * without metadata.
 */
export function dispatchMetadataOfToken(jwt: string): string | undefined {
  const { roomConfig } = claimsOfToken(jwt);
  const agents = isRecord(roomConfig) ? roomConfig.agents : undefined;
  const dispatch: unknown = Array.isArray(agents) ? agents[0] : undefined;
  if (!isRecord(dispatch)) {
    throw new Error('The Room Token dispatches no Agent.');
  }
  const { metadata } = dispatch;
  if (metadata === undefined || metadata === '') {
    return undefined;
  }
  if (typeof metadata !== 'string') {
    throw new Error('The dispatch metadata of the Room Token is not a string.');
  }
  return metadata;
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
  path: 'turns' | 'notes' | 'end',
  body?: object,
): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/api/agent/conversations/${encodeURIComponent(roomName)}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agentApiKey()}`,
        // The end marker has no body, as the Agent sends it.
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
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

/** Records a Note of the Conversation in `roomName`, as the Agent would. */
export async function postNote(
  roomName: string,
  note: PostedNote,
): Promise<void> {
  await postToAgentIngest(roomName, 'notes', note);
}

/**
 * Posts the end marker of the Conversation in `roomName`, as the Agent does
 * once it has sent every turn and Note: the backend may now write the Report
 * and update the User's learner profile.
 */
export async function postEnd(roomName: string): Promise<void> {
  await postToAgentIngest(roomName, 'end');
}

/** A moment `seconds` before now; after now when `seconds` is negative. */
export function secondsAgo(seconds: number): Date {
  return new Date(Date.now() - seconds * 1000);
}
