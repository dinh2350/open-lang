// Live tier (`pnpm test:live`): talks to the real OpenAI Realtime API and
// costs money. Skipped when OPENAI_API_KEY is absent from the environment
// and from agent/.env.
import { initializeLogger, voice } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import {
  createSessionOptions,
  loadAgentConfig,
} from '../../src/config/index.ts';
import { ConversationAgent } from '../../src/conversation-agent.ts';

/** What the Agent says first in a session, as text. */
function firstAgentMessage(session: voice.AgentSession): Promise<string> {
  return new Promise((resolve) => {
    session.on(
      voice.AgentSessionEventTypes.ConversationItemAdded,
      ({ item }) => {
        if (item.type === 'message' && item.role === 'assistant') {
          resolve(item.textContent ?? '');
        }
      },
    );
  });
}

describe.skipIf(!process.env.OPENAI_API_KEY)(
  'Agent in Realtime mode with OpenAI (live)',
  () => {
    it('greets the User first with "Hello, how can I help?"', async () => {
      initializeLogger({ pretty: true, level: 'warn' });
      const config = loadAgentConfig({
        ...process.env,
        AGENT_MODE: 'realtime',
        REALTIME_PROVIDER: 'openai',
      });
      const session = new voice.AgentSession(createSessionOptions(config));
      const greeting = firstAgentMessage(session);

      try {
        // Without a room, as LiveKit's testing docs do: the User says nothing.
        await session.start({ agent: new ConversationAgent() });

        expect(await greeting).toMatch(/hello\W+how can i help/i);
      } finally {
        await session.close();
      }
    });
  },
);
