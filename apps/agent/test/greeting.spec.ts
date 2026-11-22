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
  it("opens first, before the User says anything, with the Scenario's opening line", async () => {
    initializeLogger({ pretty: false, level: 'error' });
    const session = new voice.AgentSession({
      ...createSessionOptions(loadAgentConfig(pipelineWithFakes), 1),
      llm: new LiteralLLM(),
    });
    const greeting = firstAgentMessage(session);

    try {
      // Without a room, as in LiveKit's testing docs: the User says nothing.
      await startConversation(session, {
        scenarioId: 'daily-standup',
        speed: 1,
      });

      expect((await greeting).textContent).toBe(
        "Morning! Let's start the standup. What did you work on yesterday?",
      );
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
