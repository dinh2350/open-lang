import { initializeLogger, voice } from '@livekit/agents';
import { NOTE_LIMITS, type Note } from '@open-lang/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TutorAgent } from '../src/agent.ts';
import { createBackendClient } from '../src/backend-client.ts';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import { createSaveNoteTool } from '../src/note-tool.ts';
import {
  type FakeBackend,
  startFakeBackend,
  TEST_AGENT_API_KEY,
} from './fake-backend.ts';

const ROOM = 'conversation-notes';
const NOTES_URL = `/api/agent/conversations/${ROOM}/notes`;

const pipelineWithFakes = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
  TTS_PROVIDER: 'fake',
};

const phrase: Note = {
  kind: 'phrase',
  english: 'Yesterday I finished the login page.',
  meaning: 'Hôm qua tôi đã làm xong trang đăng nhập.',
  said: null,
};

const missed: Note = {
  kind: 'missed',
  english: 'What is blocking you?',
  meaning: 'Điều gì đang cản trở bạn? Khó ở chữ "blocking".',
  said: null,
};

describe('The saveNote tool, called by the model', () => {
  let backend: FakeBackend | undefined;
  let session: voice.AgentSession | undefined;

  afterEach(async () => {
    await session?.close();
    session = undefined;
    await backend?.close();
    backend = undefined;
  });

  /** A tutor session whose model answers each input as scripted. */
  async function tutorSession(
    fake: FakeBackend,
    responses: voice.testing.FakeLLMResponse[],
  ): Promise<voice.AgentSession> {
    initializeLogger({ pretty: false, level: 'error' });
    const started = new voice.AgentSession({
      ...createSessionOptions(loadAgentConfig(pipelineWithFakes)),
      llm: new voice.testing.FakeLLM(responses),
    });
    const client = createBackendClient({
      backendUrl: fake.url,
      agentApiKey: TEST_AGENT_API_KEY,
      retryDelayMs: 1,
    });
    await started.start({
      agent: new TutorAgent([
        createSaveNoteTool({ backend: client, roomName: ROOM }),
      ]),
    });
    return started;
  }

  function notesSentTo(fake: FakeBackend) {
    return fake.requests.filter(({ url }) => url === NOTES_URL);
  }

  it('saves a note when the model calls saveNote', async () => {
    backend = await startFakeBackend();
    session = await tutorSession(backend, [
      {
        input: 'ghi lại câu này',
        toolCalls: [{ name: 'saveNote', args: phrase }],
      },
    ]);

    const result = await session.run({ userInput: 'ghi lại câu này' }).wait();

    result.expect.containsFunctionCall({ name: 'saveNote', args: phrase });
    result.expect.containsFunctionCallOutput({ isError: false });
    expect(notesSentTo(backend)).toEqual([
      expect.objectContaining({
        method: 'POST',
        authorization: `Bearer ${TEST_AGENT_API_KEY}`,
        body: phrase,
      }),
    ]);
  });

  it('saves a missed note', async () => {
    backend = await startFakeBackend();
    session = await tutorSession(backend, [
      {
        input: 'Sorry, I could not catch that.',
        content: 'What is blocking you?',
        toolCalls: [{ name: 'saveNote', args: missed }],
      },
    ]);

    const result = await session
      .run({ userInput: 'Sorry, I could not catch that.' })
      .wait();

    result.expect.containsFunctionCall({ name: 'saveNote', args: missed });
    expect(notesSentTo(backend).map(({ body }) => body)).toEqual([missed]);
  });

  it('tells the model when a correction has no said', async () => {
    backend = await startFakeBackend();
    session = await tutorSession(backend, [
      {
        input: 'Yesterday I fix the bug.',
        toolCalls: [
          {
            name: 'saveNote',
            args: {
              kind: 'correction',
              english: 'Yesterday I fixed the bug.',
              meaning: 'Quá khứ: fix thành fixed.',
              said: null,
            },
          },
        ],
      },
    ]);

    const result = await session
      .run({ userInput: 'Yesterday I fix the bug.' })
      .wait();

    const output = result.expect
      .containsFunctionCallOutput({ isError: true })
      .event().item.output;
    expect(output).toMatch(/said/);
    expect(notesSentTo(backend)).toEqual([]);
  });

  it('treats an empty said on a non-correction as null', async () => {
    backend = await startFakeBackend();
    session = await tutorSession(backend, [
      {
        input: 'ghi lại câu này',
        toolCalls: [{ name: 'saveNote', args: { ...phrase, said: '' } }],
      },
    ]);

    const result = await session.run({ userInput: 'ghi lại câu này' }).wait();

    result.expect.containsFunctionCallOutput({ isError: false });
    expect(notesSentTo(backend).map(({ body }) => body)).toEqual([
      { ...phrase, said: null },
    ]);
  });

  it('treats a whitespace-only said on a non-correction as null', async () => {
    backend = await startFakeBackend();
    session = await tutorSession(backend, [
      {
        input: 'What is blocking you?',
        toolCalls: [{ name: 'saveNote', args: { ...missed, said: '  \n ' } }],
      },
    ]);

    const result = await session
      .run({ userInput: 'What is blocking you?' })
      .wait();

    result.expect.containsFunctionCallOutput({ isError: false });
    expect(notesSentTo(backend).map(({ body }) => body)).toEqual([
      { ...missed, said: null },
    ]);
  });

  it.each(['missed', 'phrase', 'word'] as const)(
    'drops a said the model gives a %s note, which only a correction has',
    async (kind) => {
      // Gemini does this often: the User's words as `said` on a note that is
      // not a correction. Refusing the note costs it, and the model answers
      // the refusal with another turn of speech.
      backend = await startFakeBackend();
      session = await tutorSession(backend, [
        {
          input: 'algorithm',
          toolCalls: [
            { name: 'saveNote', args: { ...missed, kind, said: 'algoritmo' } },
          ],
        },
      ]);

      const result = await session.run({ userInput: 'algorithm' }).wait();

      result.expect.containsFunctionCallOutput({ isError: false });
      expect(notesSentTo(backend).map(({ body }) => body)).toEqual([
        { ...missed, kind, said: null },
      ]);
    },
  );

  it.each([
    ['an empty said', ''],
    ['a whitespace-only said', '   '],
  ])('still refuses a blank said on a correction: %s', async (_name, blank) => {
    backend = await startFakeBackend();
    session = await tutorSession(backend, [
      {
        input: 'Yesterday I fix the bug.',
        toolCalls: [
          {
            name: 'saveNote',
            args: {
              kind: 'correction',
              english: 'Yesterday I fixed the bug.',
              meaning: 'Quá khứ: fix thành fixed.',
              said: blank,
            },
          },
        ],
      },
    ]);

    const result = await session
      .run({ userInput: 'Yesterday I fix the bug.' })
      .wait();

    const output = result.expect
      .containsFunctionCallOutput({ isError: true })
      .event().item.output;
    expect(output).toMatch(/said/);
    expect(notesSentTo(backend)).toEqual([]);
  });

  it('tells the model the limit of each field in the tool description', async () => {
    backend = await startFakeBackend();
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: TEST_AGENT_API_KEY,
      retryDelayMs: 1,
    });

    const tool = createSaveNoteTool({ backend: client, roomName: ROOM });

    expect(tool.description).toContain(
      `Keep each field under ${String(NOTE_LIMITS.english)} characters.`,
    );
    // One limit for every field, so the sentence cannot say the wrong number.
    expect(new Set(Object.values(NOTE_LIMITS)).size).toBe(1);
  });

  it('keeps talking when the backend is down', async () => {
    backend = await startFakeBackend([500, 500, 500]);
    session = await tutorSession(backend, [
      {
        input: 'ghi lại câu này',
        toolCalls: [{ name: 'saveNote', args: phrase }],
      },
      { input: 'What next?', content: 'Bây giờ mình luyện câu hỏi nhé.' },
    ]);

    await session.run({ userInput: 'ghi lại câu này' }).wait();
    const next = await session.run({ userInput: 'What next?' }).wait();

    // Three attempts, then the send gives up with a warning and resolves.
    expect(notesSentTo(backend)).toHaveLength(3);
    expect(
      next.expect.nextEvent().isMessage({ role: 'assistant' }).event().item
        .textContent,
    ).toBe('Bây giờ mình luyện câu hỏi nhé.');
  });
});
