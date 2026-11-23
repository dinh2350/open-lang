import { initializeLogger, llm, voice } from '@livekit/agents';
import { LISTENING_HELP_MESSAGE, type TurnIngest } from '@open-lang/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createBackendClient,
  type BackendClient,
} from '../src/backend-client.ts';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import { startConversation } from '../src/conversation-agent.ts';
import { createListeningHelpHandler } from '../src/listening-help.ts';
import { recordTranscript } from '../src/transcript-recorder.ts';
import {
  type FakeBackend,
  startFakeBackend,
  TEST_AGENT_API_KEY,
} from './fake-backend.ts';
import { LiteralLLM } from './literal-llm.ts';

const ROOM = 'conversation-help';
const PRESSED_AT = new Date('2026-11-23T09:30:00.000Z');
const REPHRASE_INSTRUCTION =
  'The User did not catch what you just said. Say it again in simpler words and more slowly, in English, in one or two short sentences, then carry on the conversation in your role.';

/** A session whose methods only record the order they are called in. */
function stubSession(calls: string[]) {
  const interrupt = vi.fn(() => {
    calls.push('interrupt');
  });
  const generateReply = vi.fn((options?: unknown) => {
    calls.push('generateReply');
    return options;
  });
  const session = { interrupt, generateReply } as unknown as voice.AgentSession;
  return { session, interrupt, generateReply };
}

function stubBackend(sendMiss: BackendClient['sendMiss'], calls: string[]) {
  const sendMissMock = vi.fn(
    (...args: Parameters<BackendClient['sendMiss']>) => {
      calls.push('sendMiss');
      return sendMiss(...args);
    },
  );
  const backend: BackendClient = {
    sendTurn: () => Promise.resolve(),
    sendMiss: sendMissMock,
    sendEnd: () => Promise.resolve(),
  };
  return { backend, sendMiss: sendMissMock };
}

describe('The listening help handler', () => {
  it('on the listening help message it interrupts, records the press and rephrases', () => {
    const calls: string[] = [];
    const { session, interrupt, generateReply } = stubSession(calls);
    const { backend, sendMiss } = stubBackend(() => Promise.resolve(), calls);
    const now = vi.fn(() => {
      calls.push('now');
      return PRESSED_AT;
    });

    createListeningHelpHandler({ backend, roomName: ROOM, now })(session, {
      text: LISTENING_HELP_MESSAGE,
    });

    // The press is timed before the interruption.
    expect(calls).toEqual(['now', 'interrupt', 'sendMiss', 'generateReply']);
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect(sendMiss).toHaveBeenCalledWith(ROOM, {
      pressedAt: '2026-11-23T09:30:00.000Z',
    });
    expect(generateReply).toHaveBeenCalledTimes(1);
    expect(generateReply).toHaveBeenCalledWith({
      instructions: REPHRASE_INSTRUCTION,
    });
  });

  it("any other text is answered as the User's own message", () => {
    const calls: string[] = [];
    const { session, generateReply } = stubSession(calls);
    const { backend, sendMiss } = stubBackend(() => Promise.resolve(), calls);

    createListeningHelpHandler({ backend, roomName: ROOM })(session, {
      text: 'I fixed the login bug.',
    });

    expect(calls).toEqual(['interrupt', 'generateReply']);
    expect(generateReply).toHaveBeenCalledWith({
      userInput: 'I fixed the login bug.',
    });
    expect(sendMiss).not.toHaveBeenCalled();
  });

  it('a failing sendMiss does not stop the rephrase', async () => {
    const calls: string[] = [];
    const { session, generateReply } = stubSession(calls);
    const { backend } = stubBackend(
      () => Promise.reject(new Error('backend down')),
      calls,
    );

    createListeningHelpHandler({ backend, roomName: ROOM })(session, {
      text: LISTENING_HELP_MESSAGE,
    });
    // Lets the rejected send settle: it must not become an unhandled rejection.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(generateReply).toHaveBeenCalledWith({
      instructions: REPHRASE_INSTRUCTION,
    });
  });
});

describe('Agent receiving the listening help message', () => {
  let backend: FakeBackend;

  beforeAll(async () => {
    backend = await startFakeBackend();
  });

  afterAll(async () => {
    await backend.close();
  });

  function sessionWithLiteralLlm(): voice.AgentSession {
    initializeLogger({ pretty: false, level: 'error' });
    return new voice.AgentSession({
      ...createSessionOptions(
        loadAgentConfig({
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'fake',
          LLM_PROVIDER: 'fake',
          TTS_PROVIDER: 'fake',
        }),
        1,
      ),
      llm: new LiteralLLM(),
    });
  }

  it('a press reaches the backend as a Miss', async () => {
    const session = sessionWithLiteralLlm();
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: TEST_AGENT_API_KEY,
    });
    const handler = createListeningHelpHandler({
      backend: client,
      roomName: ROOM,
      now: () => PRESSED_AT,
    });
    try {
      await startConversation(
        session,
        { scenarioId: 'daily-standup', speed: 1 },
        undefined,
        { textInputCallback: handler },
      );

      handler(session, { text: LISTENING_HELP_MESSAGE });

      const request = await vi.waitFor(() => {
        const found = backend.requests.find(
          ({ url }) => url === `/api/agent/conversations/${ROOM}/misses`,
        );
        expect(found).toBeDefined();
        return found;
      });
      expect(request).toMatchObject({
        method: 'POST',
        authorization: `Bearer ${TEST_AGENT_API_KEY}`,
        body: { pressedAt: '2026-11-23T09:30:00.000Z' },
      });
      expect(
        backend.requests.filter(({ url }) => url?.endsWith('/misses')),
      ).toHaveLength(1);
    } finally {
      await session.close();
    }
  });

  it('a press is not recorded as a User turn and leaves the interval pairing alone', async () => {
    const session = sessionWithLiteralLlm();
    const turns: TurnIngest[] = [];
    const sendMiss = vi.fn(() => Promise.resolve());
    const recorderBackend: BackendClient = {
      sendTurn: (_room: string, turn: TurnIngest) => {
        turns.push(turn);
        return Promise.resolve();
      },
      sendMiss,
      sendEnd: () => Promise.resolve(),
    };
    const recorder = recordTranscript(session, recorderBackend, ROOM);
    const handler = createListeningHelpHandler({
      backend: recorderBackend,
      roomName: ROOM,
    });
    try {
      await startConversation(
        session,
        { scenarioId: 'daily-standup', speed: 1 },
        undefined,
        { textInputCallback: handler },
      );
      await vi.waitFor(() => {
        expect(turns.length).toBeGreaterThan(0);
      });

      handler(session, { text: LISTENING_HELP_MESSAGE });
      await new Promise((resolve) => setTimeout(resolve, 200));
      await recorder.flush();

      expect(
        session.history.items.filter(
          (item) => item instanceof llm.ChatMessage && item.role === 'user',
        ),
      ).toEqual([]);
      // The recorder posts a turn again when its interval closes, with the
      // same itemId: only the Agent's greeting was ever said.
      expect(turns.filter(({ role }) => role === 'user')).toEqual([]);
      expect(new Set(turns.map(({ itemId }) => itemId)).size).toBe(1);
      expect(turns.map(({ text }) => text)).not.toContain(
        LISTENING_HELP_MESSAGE,
      );
      expect(sendMiss).toHaveBeenCalledTimes(1);
    } finally {
      await session.close();
    }
  });
});
