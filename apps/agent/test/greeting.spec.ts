import { initializeLogger, llm, voice } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import { startConversation } from '../src/conversation-agent.ts';
import { OPENING_LINE } from '../src/tutor-instructions.ts';
import { firstAgentMessage } from './agent-messages.ts';
import { LiteralLLM } from './literal-llm.ts';

const pipelineWithFakes = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
  TTS_PROVIDER: 'fake',
};

describe('Agent in Pipeline mode, run with voice.testing', () => {
  it('the opening line is Vietnamese', async () => {
    initializeLogger({ pretty: false, level: 'error' });
    const session = new voice.AgentSession({
      ...createSessionOptions(loadAgentConfig(pipelineWithFakes)),
      llm: new LiteralLLM(),
    });
    const greeting = firstAgentMessage(session);

    try {
      // Without a room, as in LiveKit's testing docs: the User says nothing.
      await startConversation(session);

      expect((await greeting).textContent).toBe(OPENING_LINE);
      expect(OPENING_LINE).toBe('Chào bạn! Hôm nay bạn muốn học gì?');
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
