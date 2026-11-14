import { initializeLogger, llm, voice } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import { startConversation } from '../src/conversation-agent.ts';
import { firstAgentMessage } from './agent-messages.ts';
import { LiteralLLM } from './literal-llm.ts';

const pipelineWithFakes = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
  TTS_PROVIDER: 'fake',
};

describe('Agent in Pipeline mode, run with voice.testing', () => {
  it('greets the User first, before the User says anything, with "Hello, how can I help?"', async () => {
    initializeLogger({ pretty: false, level: 'error' });
    const session = new voice.AgentSession({
      ...createSessionOptions(loadAgentConfig(pipelineWithFakes)),
      llm: new LiteralLLM(),
    });
    const greeting = firstAgentMessage(session);

    try {
      // Without a room, as in LiveKit's testing docs: the User says nothing.
      await startConversation(session);

      expect((await greeting).textContent).toBe('Hello, how can I help?');
      expect(
        session.history.items
          .filter((item) => item instanceof llm.ChatMessage)
          .map(({ role }) => role),
      ).toEqual(['assistant']);
    } finally {
      await session.close();
    }
  });
});
