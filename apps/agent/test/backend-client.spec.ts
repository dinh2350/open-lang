import { initializeLogger } from '@livekit/agents';
import type { Note, TurnIngest } from '@open-lang/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBackendClient,
  trackPendingSends,
} from '../src/backend-client.ts';
import {
  type FakeBackend,
  startFakeBackend,
  TEST_AGENT_API_KEY as AGENT_API_KEY,
} from './fake-backend.ts';

const turn: TurnIngest = {
  itemId: 'item_1',
  role: 'agent',
  text: "Morning! Let's start the standup.",
  startedAt: '2026-11-23T09:00:00.000Z',
  endedAt: '2026-11-23T09:00:03.500Z',
};

const note: Note = {
  kind: 'correction',
  english: 'Yesterday I fixed the bug.',
  meaning: 'Quá khứ của fix là fixed.',
  said: 'Yesterday I fix the bug.',
};

describe('Backend client', () => {
  let logLines: string[];
  let backend: FakeBackend | undefined;

  beforeEach(() => {
    initializeLogger({ pretty: false, level: 'info' });
    logLines = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(
      (chunk: string | Uint8Array) => {
        logLines.push(String(chunk));
        return true;
      },
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await backend?.close();
    backend = undefined;
  });

  it("posts a turn to the room's turns route with the Bearer key and the JSON body", async () => {
    backend = await startFakeBackend([204]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
    });

    await client.sendTurn('conversation-123', turn);

    expect(backend.requests).toEqual([
      {
        method: 'POST',
        url: '/api/agent/conversations/conversation-123/turns',
        authorization: `Bearer ${AGENT_API_KEY}`,
        contentType: 'application/json',
        body: turn,
      },
    ]);
  });

  it('posts a Miss to the misses route', async () => {
    backend = await startFakeBackend([204]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
    });

    await client.sendMiss('conversation-123', {
      pressedAt: '2026-11-23T09:00:02.000Z',
    });

    expect(backend.requests).toEqual([
      expect.objectContaining({
        method: 'POST',
        url: '/api/agent/conversations/conversation-123/misses',
        authorization: `Bearer ${AGENT_API_KEY}`,
        body: { pressedAt: '2026-11-23T09:00:02.000Z' },
      }),
    ]);
  });

  it('posts a note to the notes route', async () => {
    backend = await startFakeBackend([204]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
    });

    await client.sendNote('conversation-123', note);

    expect(backend.requests).toEqual([
      {
        method: 'POST',
        url: '/api/agent/conversations/conversation-123/notes',
        authorization: `Bearer ${AGENT_API_KEY}`,
        contentType: 'application/json',
        body: note,
      },
    ]);
  });

  it('sendNote retries three times and never rejects', async () => {
    backend = await startFakeBackend([500, 503, 500, 204]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
      retryDelayMs: 1,
    });

    await expect(
      client.sendNote('conversation-123', note),
    ).resolves.toBeUndefined();

    expect(backend.requests).toHaveLength(3);
    const log = logLines.join('');
    expect(log).toContain('conversation-123');
    expect(log).not.toContain(AGENT_API_KEY);
    expect(log).not.toContain(note.english);
  });

  it('retries a failing request and succeeds on the next attempt', async () => {
    backend = await startFakeBackend([503, 204]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
      retryDelayMs: 1,
    });

    await client.sendTurn('conversation-123', turn);

    expect(backend.requests).toHaveLength(2);
    expect(backend.requests[1]?.body).toEqual(turn);
  });

  it('gives up after three failures without throwing', async () => {
    backend = await startFakeBackend([500, 500, 500, 500]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
      retryDelayMs: 1,
    });

    await expect(
      client.sendTurn('conversation-123', turn),
    ).resolves.toBeUndefined();

    expect(backend.requests).toHaveLength(3);
    const log = logLines.join('');
    expect(log).toContain('conversation-123');
    expect(log).not.toContain(AGENT_API_KEY);
    expect(log).not.toContain(turn.text);
  });

  it('gives up without throwing when the backend cannot be reached', async () => {
    backend = await startFakeBackend([]);
    const unreachable = backend.url;
    await backend.close();
    backend = undefined;
    const client = createBackendClient({
      backendUrl: unreachable,
      agentApiKey: AGENT_API_KEY,
      retryDelayMs: 1,
    });

    await expect(
      client.sendMiss('conversation-123', {
        pressedAt: '2026-11-23T09:00:02.000Z',
      }),
    ).resolves.toBeUndefined();
    expect(logLines.join('')).toContain('conversation-123');
  });

  it("posts the end marker to the room's end route, with the Bearer key and no body", async () => {
    backend = await startFakeBackend([204]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
    });

    await client.sendEnd('conversation-123');

    expect(backend.requests).toEqual([
      {
        method: 'POST',
        url: '/api/agent/conversations/conversation-123/end',
        authorization: `Bearer ${AGENT_API_KEY}`,
        contentType: undefined,
        body: undefined,
      },
    ]);
  });

  it('retries the end marker and gives up after three failures without throwing', async () => {
    backend = await startFakeBackend([500, 500, 500, 500]);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: AGENT_API_KEY,
      retryDelayMs: 1,
    });

    await expect(client.sendEnd('conversation-123')).resolves.toBeUndefined();

    expect(backend.requests).toHaveLength(3);
    expect(logLines.join('')).toContain('conversation-123');
  });

  it('a tracked client settles once every send it started has finished', async () => {
    backend = await startFakeBackend([], { responseDelayMs: 200 });
    const tracked = trackPendingSends(
      createBackendClient({
        backendUrl: backend.url,
        agentApiKey: AGENT_API_KEY,
      }),
    );
    await expect(tracked.settled()).resolves.toBeUndefined();

    void tracked.client.sendNote('conversation-123', note);
    void tracked.client.sendTurn('conversation-123', turn);
    await tracked.settled();

    // Both were answered before settled() resolved, in whichever order.
    const answered = backend.events.filter((event) =>
      event.startsWith('answered'),
    );
    expect(answered).toHaveLength(2);
    expect(answered).toEqual(
      expect.arrayContaining([
        'answered /api/agent/conversations/conversation-123/notes',
        'answered /api/agent/conversations/conversation-123/turns',
      ]),
    );
  });
});
