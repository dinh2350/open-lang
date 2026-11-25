import {
  conversationDetailSchema,
  noteListSchema,
  type ConversationDetail,
  type Note,
  type StoredNote,
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
): Promise<void> {
  return app.get(ConversationsService).create(user, roomName);
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

/** The Agent writes a Note into the room's Conversation. */
export async function ingestNote(
  app: INestApplication<App>,
  roomName: string,
  note: Note,
): Promise<void> {
  const response = await request(app.getHttpServer())
    .post(`/api/agent/conversations/${roomName}/notes`)
    .auth(testEnv.AGENT_API_KEY, { type: 'bearer' })
    .send(note);
  if (response.status !== 204) {
    throw new Error(
      `Posting a note failed with status ${String(response.status)}`,
    );
  }
}

/** The Agent reports that the room's Conversation has ended: it sent all it had. */
export async function endConversation(
  app: INestApplication<App>,
  roomName: string,
): Promise<void> {
  const response = await request(app.getHttpServer())
    .post(`/api/agent/conversations/${roomName}/end`)
    .auth(testEnv.AGENT_API_KEY, { type: 'bearer' });
  if (response.status !== 204) {
    throw new Error(
      `Posting the end failed with status ${String(response.status)}`,
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

/** The User reads the Notes of the room's Conversation. */
export function getNotes(
  app: INestApplication<App>,
  authToken: string,
  roomName: string,
) {
  return request(app.getHttpServer())
    .get(`/api/conversations/${roomName}/notes`)
    .auth(authToken, { type: 'bearer' });
}

/** Reads the Notes of the room's Conversation, oldest first, and checks them against the contract. */
export async function listNotes(
  app: INestApplication<App>,
  authToken: string,
  roomName: string,
): Promise<StoredNote[]> {
  const response = await getNotes(app, authToken, roomName);
  if (response.status !== 200) {
    throw new Error(
      `Reading the notes failed with status ${String(response.status)}`,
    );
  }
  return noteListSchema.parse(response.body).notes;
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
