import {
  conversationDetailSchema,
  type ConversationDetail,
  type ScenarioId,
  type User,
} from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ConversationsService } from '../../src/conversations/conversations.service.js';
import { testEnv } from './test-app.js';

/** An ISO time `seconds` after 10:00:00 UTC on the day of the tests. */
export const at = (seconds: number): string =>
  new Date(Date.UTC(2026, 10, 23, 10, 0, 0) + seconds * 1000).toISOString();

/** Records a Conversation of the User in the room, as a Room Token does. */
export function startConversation(
  app: INestApplication<App>,
  user: User,
  roomName: string,
  scenarioId: ScenarioId = 'daily-standup',
): Promise<void> {
  return app.get(ConversationsService).create(user, roomName, {
    scenarioId,
    speed: 0.85,
  });
}

/** The Agent reports a turn of the room's Conversation. */
export async function ingestTurn(
  app: INestApplication<App>,
  roomName: string,
  turn: {
    readonly itemId: string;
    readonly role: 'agent' | 'user';
    readonly text: string;
    readonly startedAt: string;
    readonly endedAt?: string;
  },
): Promise<void> {
  const response = await request(app.getHttpServer())
    .post(`/api/agent/conversations/${roomName}/turns`)
    .auth(testEnv.AGENT_API_KEY, { type: 'bearer' })
    .send(turn);
  if (response.status !== 204) {
    throw new Error(
      `Posting a turn failed with status ${String(response.status)}`,
    );
  }
}

/** The Agent reports a press of "I did not catch that" in the room. */
export async function ingestMiss(
  app: INestApplication<App>,
  roomName: string,
  pressedAt: string,
): Promise<void> {
  const response = await request(app.getHttpServer())
    .post(`/api/agent/conversations/${roomName}/misses`)
    .auth(testEnv.AGENT_API_KEY, { type: 'bearer' })
    .send({ pressedAt });
  if (response.status !== 204) {
    throw new Error(
      `Posting a Miss failed with status ${String(response.status)}`,
    );
  }
}

/** The User asks for the Report of the room's Conversation. */
export function requestReport(
  app: INestApplication<App>,
  authToken: string,
  roomName: string,
) {
  return request(app.getHttpServer())
    .post(`/api/conversations/${roomName}/report`)
    .auth(authToken, { type: 'bearer' });
}

/** The User reads the room's Conversation. */
export function getConversation(
  app: INestApplication<App>,
  authToken: string,
  roomName: string,
) {
  return request(app.getHttpServer())
    .get(`/api/conversations/${roomName}`)
    .auth(authToken, { type: 'bearer' });
}

/** Reads the room's Conversation and checks it against the contract. */
export async function readConversation(
  app: INestApplication<App>,
  authToken: string,
  roomName: string,
): Promise<ConversationDetail> {
  const response = await getConversation(app, authToken, roomName);
  if (response.status !== 200) {
    throw new Error(
      `Reading a Conversation failed with status ${String(response.status)}`,
    );
  }
  return conversationDetailSchema.parse(response.body);
}
