import {
  MAX_NOTES_PER_CONVERSATION,
  NOTE_LIMITS,
  type AuthResponse,
  type Note,
} from '@open-lang/shared';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConversationsService } from '../src/conversations/conversations.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ingestNote, listNotes } from './support/conversations.js';
import { startTestApp, stopTestApp, testEnv } from './support/test-app.js';
import { registerUser } from './support/users.js';

const ROOM_NAME = 'room-under-test';
const STARTED_AT = '2026-11-23T10:00:00.000Z';
const ENDED_AT = '2026-11-23T10:00:04.500Z';

describe('The Agent ingest API', () => {
  let app: INestApplication<App>;
  let signedIn: AuthResponse;

  beforeEach(async () => {
    app = await startTestApp();
    signedIn = await registerUser(app);
    await app.get(ConversationsService).create(signedIn.user, ROOM_NAME);
  });

  afterEach(async () => {
    await stopTestApp(app);
  });

  /** Posts to a room's ingest route with `key` as the bearer token, or with no key at all. */
  function ingest(
    route: 'turns' | 'misses' | 'notes' | 'end',
    body: object,
    key: string | null = testEnv.AGENT_API_KEY,
    roomName = ROOM_NAME,
  ) {
    const call = request(app.getHttpServer())
      .post(`/api/agent/conversations/${roomName}/${route}`)
      .send(body);
    return key === null ? call : call.auth(key, { type: 'bearer' });
  }

  const turn = (overrides: Readonly<Record<string, unknown>> = {}) => ({
    itemId: 'item-1',
    role: 'agent',
    text: 'Morning! What did you work on yesterday?',
    startedAt: STARTED_AT,
    ...overrides,
  });

  const miss = { pressedAt: STARTED_AT };

  const note = (overrides: Readonly<Partial<Note>> = {}): Note => ({
    kind: 'phrase',
    english: 'I finished the report yesterday.',
    meaning: 'Tôi đã hoàn thành báo cáo hôm qua.',
    said: null,
    ...overrides,
  });

  const correction = (overrides: Readonly<Partial<Note>> = {}): Note =>
    note({
      kind: 'correction',
      english: 'I finished the report yesterday.',
      said: 'I finish the report yesterday.',
      meaning: 'Chuyện đã xong dùng thì quá khứ: finished.',
      ...overrides,
    });

  const storedTurns = () => app.get(PrismaService).turn.findMany();
  const storedMisses = () => app.get(PrismaService).miss.findMany();
  const storedNotes = () => app.get(PrismaService).note.findMany();
  const storedEnd = async () =>
    (
      await app.get(PrismaService).conversation.findUniqueOrThrow({
        where: { roomName: ROOM_NAME },
        select: { endedAt: true },
      })
    ).endedAt;

  it('returns 401 without a key and with a wrong key', async () => {
    const calls = [
      ingest('turns', turn(), null),
      ingest('misses', miss, null),
      ingest('turns', turn(), 'wrong-key'),
      ingest('misses', miss, 'wrong-key'),
      // One character short of the real key: a different length.
      ingest('turns', turn(), testEnv.AGENT_API_KEY.slice(1)),
      // The same length as the real key, but not the key.
      ingest('turns', turn(), 'x'.repeat(testEnv.AGENT_API_KEY.length)),
    ];

    const statuses = (await Promise.all(calls)).map(({ status }) => status);

    expect(statuses).toEqual([401, 401, 401, 401, 401, 401]);
    expect(await storedTurns()).toEqual([]);
    expect(await storedMisses()).toEqual([]);
  });

  it("a User's own Auth Token is not an Agent key", async () => {
    const turnResponse = await ingest('turns', turn(), signedIn.authToken);
    const missResponse = await ingest('misses', miss, signedIn.authToken);

    expect(turnResponse.status).toBe(401);
    expect(missResponse.status).toBe(401);
    expect(await storedTurns()).toEqual([]);
    expect(await storedMisses()).toEqual([]);
  });

  it('the Agent key is not a User token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(testEnv.AGENT_API_KEY, { type: 'bearer' });

    expect(response.status).toBe(401);
  });

  it('returns 404 for a room that has no Conversation', async () => {
    const turnResponse = await ingest(
      'turns',
      turn(),
      testEnv.AGENT_API_KEY,
      'no-such-room',
    );
    const missResponse = await ingest(
      'misses',
      miss,
      testEnv.AGENT_API_KEY,
      'no-such-room',
    );

    expect(turnResponse.status).toBe(404);
    expect(missResponse.status).toBe(404);
    expect(await storedTurns()).toEqual([]);
    expect(await storedMisses()).toEqual([]);
  });

  it('stores a turn', async () => {
    const response = await ingest('turns', turn({ endedAt: ENDED_AT }));

    expect(response.status).toBe(204);
    const turns = await storedTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      itemId: 'item-1',
      role: 'agent',
      text: 'Morning! What did you work on yesterday?',
      startedAt: new Date(STARTED_AT),
      endedAt: new Date(ENDED_AT),
    });
  });

  it('stores a retried turn once, with its latest values', async () => {
    const first = await ingest('turns', turn());
    const second = await ingest(
      'turns',
      turn({ text: 'Morning! What did you do yesterday?', endedAt: ENDED_AT }),
    );

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    const turns = await storedTurns();
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({
      text: 'Morning! What did you do yesterday?',
      startedAt: new Date(STARTED_AT),
      endedAt: new Date(ENDED_AT),
    });
  });

  it('rejects a turn with empty text', async () => {
    const response = await ingest('turns', turn({ text: '' }));

    expect(response.status).toBe(400);
    expect(await storedTurns()).toEqual([]);
  });

  it('rejects a Miss without a time', async () => {
    const response = await ingest('misses', {});

    expect(response.status).toBe(400);
    expect(await storedMisses()).toEqual([]);
  });

  it('stores a Miss', async () => {
    const response = await ingest('misses', miss);

    expect(response.status).toBe(204);
    const misses = await storedMisses();
    expect(misses).toHaveLength(1);
    expect(misses[0]?.pressedAt).toEqual(new Date(STARTED_AT));
  });

  it('rejects a turn that ends before it starts, and stores nothing', async () => {
    const response = await ingest(
      'turns',
      turn({ startedAt: ENDED_AT, endedAt: STARTED_AT }),
    );

    expect(response.status).toBe(400);
    expect(await storedTurns()).toEqual([]);
  });

  it('stores a note the Agent sends', async () => {
    await ingestNote(app, ROOM_NAME, correction());

    const notes = await listNotes(app, signedIn.authToken, ROOM_NAME);

    // `listNotes` has checked the id and the time against the contract.
    expect(notes).toMatchObject([
      {
        kind: 'correction',
        english: 'I finished the report yesterday.',
        meaning: 'Chuyện đã xong dùng thì quá khứ: finished.',
        said: 'I finish the report yesterday.',
      },
    ]);
  });

  it('stores the same note once, however often the Agent sends it', async () => {
    const first = await ingest('notes', note());
    const second = await ingest('notes', note());
    // The same sentence as another kind of note is another note.
    const otherKind = await ingest('notes', note({ kind: 'word' }));

    expect([first.status, second.status, otherKind.status]).toEqual([
      204, 204, 204,
    ]);
    const notes = await storedNotes();
    expect(notes).toHaveLength(2);
    expect(new Set(notes.map(({ kind }) => kind))).toEqual(
      new Set(['phrase', 'word']),
    );
  });

  it('keeps the first 50 notes and ignores the rest', async () => {
    const statuses: number[] = [];
    for (let index = 1; index <= MAX_NOTES_PER_CONVERSATION + 1; index += 1) {
      const response = await ingest(
        'notes',
        note({ english: `Sentence number ${String(index)}.` }),
      );
      statuses.push(response.status);
    }

    expect(statuses).toEqual(
      Array.from({ length: MAX_NOTES_PER_CONVERSATION + 1 }, () => 204),
    );
    const notes = await listNotes(app, signedIn.authToken, ROOM_NAME);
    expect(notes).toHaveLength(MAX_NOTES_PER_CONVERSATION);
    expect(notes.map(({ english }) => english)).not.toContain(
      `Sentence number ${String(MAX_NOTES_PER_CONVERSATION + 1)}.`,
    );
  });

  it('still answers 204 for a repeat of a note once the Conversation is full', async () => {
    for (let index = 1; index <= MAX_NOTES_PER_CONVERSATION; index += 1) {
      await ingestNote(
        app,
        ROOM_NAME,
        note({ english: `Sentence number ${String(index)}.` }),
      );
    }

    const response = await ingest(
      'notes',
      note({ english: 'Sentence number 1.' }),
    );

    expect(response.status).toBe(204);
    expect(await storedNotes()).toHaveLength(MAX_NOTES_PER_CONVERSATION);
  });

  it('refuses a correction without said', async () => {
    const response = await ingest('notes', correction({ said: null }));

    expect(response.status).toBe(400);
    expect(await storedNotes()).toEqual([]);
  });

  it('refuses a said on a note that is not a correction', async () => {
    const response = await ingest('notes', note({ said: 'I finish it.' }));

    expect(response.status).toBe(400);
    expect(await storedNotes()).toEqual([]);
  });

  it('refuses english over 120 characters', async () => {
    const response = await ingest(
      'notes',
      note({ english: 'x'.repeat(NOTE_LIMITS.english + 1) }),
    );

    expect(response.status).toBe(400);
    expect(await storedNotes()).toEqual([]);
  });

  it('refuses a request without the Agent key', async () => {
    const calls = [
      ingest('notes', note(), null),
      ingest('notes', note(), 'wrong-key'),
      ingest('notes', note(), signedIn.authToken),
    ];
    const turnWithoutKey = await ingest('turns', turn(), null);

    const statuses = (await Promise.all(calls)).map(({ status }) => status);

    expect(statuses).toEqual([
      turnWithoutKey.status,
      turnWithoutKey.status,
      turnWithoutKey.status,
    ]);
    expect(turnWithoutKey.status).toBe(401);
    expect(await storedNotes()).toEqual([]);
  });

  it('returns 404 for a note of a room that has no Conversation', async () => {
    const response = await ingest(
      'notes',
      note(),
      testEnv.AGENT_API_KEY,
      'no-such-room',
    );

    expect(response.status).toBe(404);
    expect(await storedNotes()).toEqual([]);
  });

  it('recordNote stores whatever the browser does', async () => {
    // The Conversation has no Report and no turn: the browser never came back.
    expect(await storedTurns()).toEqual([]);
    expect(await app.get(PrismaService).report.findMany()).toEqual([]);

    await app.get(ConversationsService).recordNote(ROOM_NAME, note());

    expect(await storedNotes()).toMatchObject([
      { kind: 'phrase', english: 'I finished the report yesterday.' },
    ]);
  });

  it('the end route is Agent-only, 404 for unknown rooms and idempotent', async () => {
    const refused = await Promise.all([
      ingest('end', {}, null),
      ingest('end', {}, 'wrong-key'),
      ingest('end', {}, signedIn.authToken),
    ]);
    expect(refused.map(({ status }) => status)).toEqual([401, 401, 401]);
    expect(await storedEnd()).toBeNull();

    const unknown = await ingest(
      'end',
      {},
      testEnv.AGENT_API_KEY,
      'no-such-room',
    );
    expect(unknown.status).toBe(404);

    const before = Date.now();
    const first = await ingest('end', {});
    expect(first.status).toBe(204);
    const endedAt = await storedEnd();
    expect(endedAt?.getTime()).toBeGreaterThanOrEqual(before);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await ingest('end', {});
    expect(second.status).toBe(204);
    expect(await storedEnd()).toEqual(endedAt);
  });
});
