import assert from 'node:assert/strict';
import { initializeLogger, llm, voice } from '@livekit/agents';
import type { Note } from '@open-lang/shared';
import { afterEach } from 'vitest';
import { createBackendClient } from '../../src/backend-client.ts';
import {
  createSessionOptions,
  loadAgentConfig,
} from '../../src/config/index.ts';
import { startConversation } from '../../src/conversation-agent.ts';
import { createSaveNoteTool } from '../../src/note-tool.ts';
import { firstAgentMessage } from '../agent-messages.ts';
import { startFakeBackend, TEST_AGENT_API_KEY } from '../fake-backend.ts';

const ROOM = 'live-tutor';
const NOTES_URL = `/api/agent/conversations/${ROOM}/notes`;

/** The Agent Mode and Provider a live check runs the tutor with. */
export interface LiveTarget {
  mode: 'realtime' | 'pipeline';
  provider: 'openai' | 'google';
}

/** A tutor started for one live check, with a fake backend to hear its notes. */
export interface LiveTutor {
  /** What the tutor said first. */
  opening: llm.ChatMessage;
  /** The language model that judges what the tutor says. */
  judge: llm.LLM;
  /** One turn of the Conversation: the User types `userInput`, the tutor answers. */
  say(userInput: string): Promise<voice.testing.RunResult>;
  /** The notes the tutor has saved so far, as the fake backend received them. */
  notes(): Note[];
}

function agentEnvironment({ mode, provider }: LiveTarget): NodeJS.ProcessEnv {
  return mode === 'realtime'
    ? { ...process.env, AGENT_MODE: 'realtime', REALTIME_PROVIDER: provider }
    : {
        ...process.env,
        AGENT_MODE: 'pipeline',
        STT_PROVIDER: provider,
        LLM_PROVIDER: provider,
        TTS_PROVIDER: provider,
      };
}

/**
 * The judge is the Provider's default Pipeline language model, since a
 * realtime model can't judge.
 */
function judgeOf(provider: LiveTarget['provider']): llm.LLM {
  const { llm: judge } = createSessionOptions(
    loadAgentConfig({
      ...process.env,
      AGENT_MODE: 'pipeline',
      STT_PROVIDER: 'fake',
      LLM_PROVIDER: provider,
      LLM_MODEL: undefined,
      TTS_PROVIDER: 'fake',
    }),
  );
  assert(judge instanceof llm.LLM, 'Pipeline mode has a language model');
  return judge;
}

/**
 * Registers the cleanup of the tutors a describe block starts, and returns
 * the function that starts one: a fresh tutor in the given Agent Mode, with
 * the `saveNote` tool wired to a fake backend, that has said its opening
 * line. Without a room, as LiveKit's testing docs do: the User types.
 */
export function liveTutor(target: LiveTarget): () => Promise<LiveTutor> {
  const cleanups: (() => Promise<void>)[] = [];
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
  });

  return async () => {
    initializeLogger({ pretty: true, level: 'warn' });
    const session = new voice.AgentSession(
      createSessionOptions(loadAgentConfig(agentEnvironment(target))),
    );
    const backend = await startFakeBackend();
    cleanups.push(async () => {
      await session.close();
      await backend.close();
    });

    const opening = firstAgentMessage(session);
    const client = createBackendClient({
      backendUrl: backend.url,
      agentApiKey: TEST_AGENT_API_KEY,
      retryDelayMs: 1,
    });
    await startConversation(session, {
      tools: [createSaveNoteTool({ backend: client, roomName: ROOM })],
    });

    return {
      opening: await opening,
      judge: judgeOf(target.provider),
      say: (userInput) => session.run({ userInput }).wait(),
      notes: () =>
        backend.requests
          .filter(({ url }) => url === NOTES_URL)
          .map(({ body }) => body as Note),
    };
  };
}
