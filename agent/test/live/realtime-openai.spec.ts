// Live tier (`pnpm test:live`): talks to the real OpenAI Realtime API and
// costs money. Skipped when OPENAI_API_KEY is absent from the environment
// and from agent/.env.
import assert from 'node:assert/strict';
import { initializeLogger, llm, voice } from '@livekit/agents';
import { describe, it } from 'vitest';
import {
  createSessionOptions,
  loadAgentConfig,
} from '../../src/config/index.ts';
import { startConversation } from '../../src/conversation-agent.ts';
import { assertAgentMessage, firstAgentMessage } from '../agent-messages.ts';

describe.skipIf(!process.env.OPENAI_API_KEY)(
  'Agent in Realtime mode with OpenAI (live)',
  () => {
    it('greets the User first, then answers a simple question', async () => {
      initializeLogger({ pretty: true, level: 'warn' });
      const config = loadAgentConfig({
        ...process.env,
        AGENT_MODE: 'realtime',
        REALTIME_PROVIDER: 'openai',
      });
      // The judge is the Provider's default Pipeline language model, since a
      // realtime model can't judge.
      const judge = createSessionOptions(
        loadAgentConfig({
          ...process.env,
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'fake',
          LLM_PROVIDER: 'openai',
          LLM_MODEL: undefined,
          TTS_PROVIDER: 'fake',
        }),
      ).llm;
      assert(judge instanceof llm.LLM, 'Pipeline mode has a language model');
      const session = new voice.AgentSession(createSessionOptions(config));
      const greeting = firstAgentMessage(session);

      try {
        // Without a room, as LiveKit's testing docs do: the User types.
        await startConversation(session);

        await assertAgentMessage(await greeting).judge(judge, {
          intent:
            'Greets the user and offers to help, such as "Hello, how can I help?"',
        });

        const answer = await session
          .run({ userInput: 'What is the capital of France?' })
          .wait();
        await answer.expect
          .nextEvent()
          .isMessage({ role: 'assistant' })
          .judge(judge, {
            intent: 'Says that the capital of France is Paris.',
          });
      } finally {
        await session.close();
      }
    });
  },
);
