// Live tier (`pnpm test:live`): talks to the real Gemini Live API and costs
// money. Skipped unless the environment or agent/.env has Google
// credentials: GOOGLE_API_KEY, or Vertex AI through GOOGLE_GENAI_USE_VERTEXAI.
import { initializeLogger, voice } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import {
  createSessionOptions,
  loadAgentConfig,
} from '../../src/config/index.ts';
import { startConversation } from '../../src/conversation-agent.ts';
import { firstAgentMessage } from './agent-messages.ts';
import { hasGoogleCredentials } from './google-credentials.ts';

describe.skipIf(!hasGoogleCredentials(process.env))(
  'Agent in Realtime mode with Google (live)',
  () => {
    it('greets the User first with "Hello, how can I help?"', async () => {
      initializeLogger({ pretty: true, level: 'warn' });
      const config = loadAgentConfig({
        ...process.env,
        AGENT_MODE: 'realtime',
        REALTIME_PROVIDER: 'google',
      });
      const session = new voice.AgentSession(createSessionOptions(config));
      const greeting = firstAgentMessage(session);

      try {
        // Without a room, as LiveKit's testing docs do: the User says nothing.
        await startConversation(session);

        expect((await greeting).textContent).toMatch(/hello\W+how can i help/i);
      } finally {
        await session.close();
      }
    });
  },
);
