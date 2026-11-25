import {
  conversationListSchema,
  type AuthResponse,
  type Note,
} from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  at,
  endConversation,
  getConversation,
  getNotes,
  ingestNote,
  ingestTurn,
  listNotes,
  readConversation,
  requestReport,
  startConversation,
} from './support/conversations.js';
import { startTestApp, stopTestApp } from './support/test-app.js';
import { registerUser } from './support/users.js';

/** A Note that makes a Conversation worth listing, whatever else it holds. */
const ANY_NOTE: Note = {
  kind: 'word',
  english: 'on track',
  meaning: 'đúng tiến độ',
  said: null,
};

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

  it('lists Conversations without scenarioId or speed keys', async () => {
    await startConversation(app, ada.user, 'room-old');
    await startConversation(app, ada.user, 'room-new');
    await startConversation(app, grace.user, 'room-grace');
    const prisma = app.get(PrismaService);
    await prisma.conversation.update({
      where: { roomName: 'room-old' },
      data: { createdAt: new Date('2026-11-22T09:00:00.000Z') },
    });
    await prisma.conversation.update({
      where: { roomName: 'room-new' },
      data: { createdAt: new Date('2026-11-23T09:00:00.000Z') },
    });
    await ingestNote(app, 'room-new', ANY_NOTE);
    await ingestNote(app, 'room-grace', ANY_NOTE);
    await ingestTurn(app, 'room-old', {
      itemId: 'a',
      role: 'agent',
      text: 'Morning!',
      startedAt: at(0),
      endedAt: at(4.5),
    });
    await endConversation(app, 'room-old');
    await requestReport(app, ada.authToken, 'room-old').expect(202);
    await vi.waitFor(async () => {
      const detail = await readConversation(app, ada.authToken, 'room-old');
      expect(detail.reportStatus).toBe('ready');
    });

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .auth(ada.authToken, { type: 'bearer' });

    expect(response.status).toBe(200);
    // The raw body, not the parsed one: parsing would strip extra keys.
    expect(response.body).toEqual({
      conversations: [
        {
          roomName: 'room-new',
          createdAt: '2026-11-23T09:00:00.000Z',
          durationSeconds: null,
          reportStatus: null,
          noteCount: 1,
        },
        {
          roomName: 'room-old',
          createdAt: '2026-11-22T09:00:00.000Z',
          durationSeconds: 4.5,
          reportStatus: 'ready',
          noteCount: 0,
        },
      ],
    });
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

  it('lists noteCount', async () => {
    await startConversation(app, ada.user, 'room-two');
    await startConversation(app, ada.user, 'room-none');
    await startConversation(app, grace.user, 'room-grace');
    await ingestNote(app, 'room-two', ANY_NOTE);
    await ingestNote(app, 'room-two', {
      kind: 'phrase',
      english: 'Let me circle back to that.',
      meaning: 'Để tôi quay lại việc đó sau.',
      said: null,
    });
    await ingestNote(app, 'room-grace', ANY_NOTE);
    await ingestTurn(app, 'room-none', {
      itemId: 'a',
      role: 'agent',
      text: 'Morning!',
      startedAt: at(0),
    });

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .auth(ada.authToken, { type: 'bearer' });

    expect(response.status).toBe(200);
    const counts = Object.fromEntries(
      conversationListSchema
        .parse(response.body)
        .conversations.map(({ roomName, noteCount }) => [roomName, noteCount]),
    );
    expect(counts).toEqual({ 'room-two': 2, 'room-none': 0 });
  });

  it('shows noteCount in the Conversation too', async () => {
    await startConversation(app, ada.user, 'room-two');
    await ingestNote(app, 'room-two', ANY_NOTE);
    await ingestNote(app, 'room-two', {
      kind: 'phrase',
      english: 'Let me circle back to that.',
      meaning: 'Để tôi quay lại việc đó sau.',
      said: null,
    });

    const detail = await readConversation(app, ada.authToken, 'room-two');

    expect(detail.noteCount).toBe(2);
  });

  it('does not list a Conversation that has no turns and no Notes', async () => {
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

  it('a Conversation with only notes appears in the list', async () => {
    await startConversation(app, ada.user, 'room-notes');
    await ingestNote(app, 'room-notes', {
      kind: 'word',
      english: 'on track',
      meaning: 'đúng tiến độ',
      said: null,
    });

    expect(await listedRooms()).toEqual(['room-notes']);
  });

  it('lists notes oldest first', async () => {
    await startConversation(app, ada.user, 'room-notes');
    const notes: Note[] = [
      {
        kind: 'phrase',
        english: 'Let me circle back to that.',
        meaning: 'Để tôi quay lại việc đó sau.',
        said: null,
      },
      {
        kind: 'correction',
        english: 'I finished the report yesterday.',
        meaning: 'Chuyện đã xong dùng thì quá khứ.',
        said: 'I finish the report yesterday.',
      },
      {
        kind: 'missed',
        english: 'Could you walk me through it?',
        meaning: 'Bạn có thể hướng dẫn tôi từng bước không?',
        said: null,
      },
    ];
    for (const note of notes) {
      await ingestNote(app, 'room-notes', note);
    }

    const stored = await listNotes(app, ada.authToken, 'room-notes');

    expect(stored).toMatchObject(notes);
    const times = stored.map(({ createdAt }) => createdAt);
    expect(times).toEqual([...times].sort((a, b) => a.localeCompare(b)));
  });

  it('lists no notes for a Conversation that has none', async () => {
    await startConversation(app, ada.user, 'room-empty');

    expect(await listNotes(app, ada.authToken, 'room-empty')).toEqual([]);
  });

  it("answers 404 for a room that is another Member's", async () => {
    await startConversation(app, grace.user, 'room-grace');
    await ingestNote(app, 'room-grace', {
      kind: 'word',
      english: 'on track',
      meaning: 'đúng tiến độ',
      said: null,
    });

    const response = await getNotes(app, ada.authToken, 'room-grace');
    const unknown = await getNotes(app, ada.authToken, 'no-such-room');

    expect(response.status).toBe(404);
    expect(unknown.status).toBe(404);
  });

  it('lists a ready Report whose stored content breaks the contract as failed', async () => {
    await startConversation(app, ada.user, 'room-broken');
    await ingestNote(app, 'room-broken', ANY_NOTE);
    const prisma = app.get(PrismaService);
    const { id } = await prisma.conversation.findUniqueOrThrow({
      where: { roomName: 'room-broken' },
    });
    await prisma.report.create({
      data: { conversationId: id, status: 'ready', content: { fluency: 1 } },
    });

    const response = await request(app.getHttpServer())
      .get('/api/conversations')
      .auth(ada.authToken, { type: 'bearer' });

    expect(response.status).toBe(200);
    expect(
      conversationListSchema
        .parse(response.body)
        .conversations.map((conversation) => conversation.reportStatus),
    ).toEqual(['failed']);
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
        request(app.getHttpServer()).get('/api/conversations/room-ada/notes'),
      ])
    ).map(({ status }) => status);

    expect(statuses).toEqual([401, 401, 401, 401]);
  });
});
