import { conversationListSchema, type AuthResponse } from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  at,
  getConversation,
  ingestMiss,
  ingestTurn,
  readConversation,
  requestReport,
  startConversation,
} from './support/conversations.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

describe('The Conversation API', () => {
  let app: INestApplication<App>;
  let ada: AuthResponse;
  let grace: AuthResponse;

  beforeEach(async () => {
    app = await startTestApp();
    ada = await registerUser(app, 'ada@example.test');
    grace = await registerUser(app, 'grace@example.test');
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  it("lists only the signed-in User's Conversations, newest first, with Scenario, speed, duration and report status", async () => {
    await startConversation(app, ada.user, 'room-old', 'daily-standup');
    await startConversation(app, ada.user, 'room-new', 'one-on-one');
    await startConversation(app, grace.user, 'room-grace', 'client-delay-call');
    const prisma = app.get(PrismaService);
    await prisma.conversation.update({
      where: { roomName: 'room-old' },
      data: { createdAt: new Date('2026-11-22T09:00:00.000Z') },
    });
    await prisma.conversation.update({
      where: { roomName: 'room-new' },
      data: { createdAt: new Date('2026-11-23T09:00:00.000Z') },
    });
    await ingestMiss(app, 'room-new', at(1));
    await ingestMiss(app, 'room-grace', at(1));
    await ingestTurn(app, 'room-old', {
      itemId: 'a',
      role: 'agent',
      text: 'Morning!',
      startedAt: at(0),
      endedAt: at(4.5),
    });
    await requestReport(app, ada.authToken, 'room-old').expect(202);
    await vi.waitFor(async () => {
      const detail = await readConversation(app, ada.authToken, 'room-old');
      expect(detail.reportStatus).toBe('ready');
    });

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .auth(ada.authToken, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(conversationListSchema.parse(response.body).conversations).toEqual([
      {
        roomName: 'room-new',
        scenarioId: 'one-on-one',
        speed: 0.85,
        createdAt: '2026-11-23T09:00:00.000Z',
        durationSeconds: null,
        reportStatus: null,
      },
      {
        roomName: 'room-old',
        scenarioId: 'daily-standup',
        speed: 0.85,
        createdAt: '2026-11-22T09:00:00.000Z',
        durationSeconds: 4.5,
        reportStatus: 'ready',
      },
    ]);
  });

  /** The room names the User's list shows. */
  async function listedRooms(): Promise<string[]> {
    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .auth(ada.authToken, { type: 'bearer' });
    expect(response.status).toBe(200);
    return conversationListSchema
      .parse(response.body)
      .conversations.map((conversation) => conversation.roomName);
  }

  it('does not list a Conversation that has no turns and no Misses', async () => {
    await startConversation(app, ada.user, 'room-empty');

    expect(await listedRooms()).toEqual([]);
  });

  it('lists a Conversation that has only a turn', async () => {
    await startConversation(app, ada.user, 'room-turn');
    await ingestTurn(app, 'room-turn', {
      itemId: 'a',
      role: 'agent',
      text: 'Morning!',
      startedAt: at(0),
    });

    expect(await listedRooms()).toEqual(['room-turn']);
  });

  it('lists a Conversation that has only a Miss', async () => {
    await startConversation(app, ada.user, 'room-miss');
    await ingestMiss(app, 'room-miss', at(1));

    expect(await listedRooms()).toEqual(['room-miss']);
  });

  it('still returns an empty Conversation by its room name', async () => {
    await startConversation(app, ada.user, 'room-empty');

    const detail = await readConversation(app, ada.authToken, 'room-empty');

    expect(detail).toMatchObject({ roomName: 'room-empty', report: null });
  });

  it('shows a Conversation without a Report, with a null report', async () => {
    await startConversation(app, ada.user, 'room-ada');

    const detail = await readConversation(app, ada.authToken, 'room-ada');

    expect(detail).toMatchObject({
      roomName: 'room-ada',
      reportStatus: null,
      report: null,
    });
  });

  it("another User's Conversation answers 404", async () => {
    await startConversation(app, grace.user, 'room-grace');

    const response = await getConversation(app, ada.authToken, 'room-grace');

    expect(response.status).toBe(404);
  });

  it('an unknown room answers 404', async () => {
    const response = await getConversation(app, ada.authToken, 'no-such-room');

    expect(response.status).toBe(404);
  });

  it('requires an Auth Token', async () => {
    await startConversation(app, ada.user, 'room-ada');

    const statuses = (
      await Promise.all([
        request(app.getHttpServer()).get('/api/conversations'),
        request(app.getHttpServer()).get('/api/conversations/room-ada'),
        request(app.getHttpServer()).post('/api/conversations/room-ada/report'),
      ])
    ).map(({ status }) => status);

    expect(statuses).toEqual([401, 401, 401]);
  });
});
