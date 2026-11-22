// Live tier (`pnpm test:live`): talks to the real Gemini APIs and costs
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
  'Agent in Pipeline mode with Google (live)',
  () => {
    it('greets the User first, then answers a simple question', async () => {
      initializeLogger({ pretty: true, level: 'warn' });
      const options = createSessionOptions(
        loadAgentConfig({
          ...process.env,
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'google',
          LLM_PROVIDER: 'google',
          TTS_PROVIDER: 'google',
        }),
      );
      // The judge is the Agent's own language model.
      const judge = options.llm;
      assert(judge instanceof llm.LLM, 'Pipeline mode has a language model');
      const session = new voice.AgentSession(options);
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
