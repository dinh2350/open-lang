// Live tier (`pnpm test:live`): talks to the real Gemini Live API and costs
// money. Skipped unless the environment or apps/agent/.env has Google
// credentials: GOOGLE_API_KEY, or Vertex AI through GOOGLE_GENAI_USE_VERTEXAI.
import assert from 'node:assert/strict';
import { initializeLogger, llm, voice } from '@livekit/agents';
import { describe, it } from 'vitest';
import {
  createSessionOptions,
  loadAgentConfig,
} from '../../src/config/index.ts';
import { startConversation } from '../../src/conversation-agent.ts';
import { assertAgentMessage, firstAgentMessage } from '../agent-messages.ts';
import { hasGoogleCredentials } from './google-credentials.ts';

describe.skipIf(!hasGoogleCredentials(process.env))(
  'Agent in Realtime mode with Google (live)',
  () => {
    it('opens the standup first, then stays in role without correcting the User', async () => {
      initializeLogger({ pretty: true, level: 'warn' });
      const config = loadAgentConfig({
        ...process.env,
        AGENT_MODE: 'realtime',
        REALTIME_PROVIDER: 'google',
      });
      // The judge is the Provider's default Pipeline language model, since a
      // realtime model can't judge.
      const judge = createSessionOptions(
        loadAgentConfig({
          ...process.env,
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'fake',
          LLM_PROVIDER: 'google',
          LLM_MODEL: undefined,
          TTS_PROVIDER: 'fake',
        }),
        1,
      ).llm;
      assert(judge instanceof llm.LLM, 'Pipeline mode has a language model');
      const session = new voice.AgentSession(createSessionOptions(config, 1));
      const greeting = firstAgentMessage(session);

      try {
        // Without a room, as LiveKit's testing docs do: the User types.
        await startConversation(session, {
          scenarioId: 'daily-standup',
          speed: 1,
        });

        await assertAgentMessage(await greeting).judge(judge, {
          intent:
            'Opens a daily standup, such as "Morning! Let\'s start the standup. What did you work on yesterday?"',
        });

        const answer = await session
          .run({ userInput: 'Yesterday I fix a bug in the login page.' })
          .wait();
        await answer.expect
          .nextEvent()
          .isMessage({ role: 'assistant' })
          .judge(judge, {
            intent:
              'Answers in English as the standup lead, briefly, for example with a follow-up question, and does not correct the grammar of what the user said.',
          });
      } finally {
        await session.close();
      }
    });
  },
);
