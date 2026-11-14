import { initializeLogger, llm, voice } from '@livekit/agents';
import { describe, expect, it, vi } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import { startConversation } from '../src/conversation-agent.ts';

const pipelineWithFakes = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'fake',
  LLM_PROVIDER: 'fake',
  TTS_PROVIDER: 'fake',
};

/** The messages the Agent sends its language model, in order. */
function messagesOf(chatCtx: llm.ChatContext) {
  return chatCtx.items
    .filter((item) => item instanceof llm.ChatMessage)
    .map((message) => ({ role: message.role, text: message.textContent }));
}

describe('Agent in Pipeline mode, run with voice.testing', () => {
  it('greets the User first: before the User says anything, it asks its language model to say "Hello, how can I help?"', async () => {
    initializeLogger({ pretty: false, level: 'error' });
    const languageModel = new voice.testing.FakeLLM();
    const requests = vi.spyOn(languageModel, 'chat');
    const session = new voice.AgentSession({
      ...createSessionOptions(loadAgentConfig(pipelineWithFakes)),
      llm: languageModel,
    });

    try {
      // Without a room, as in LiveKit's testing docs: the User says nothing.
      await startConversation(session);
      await vi.waitFor(() => {
        expect(requests).toHaveBeenCalledOnce();
      });
    } finally {
      await session.close();
    }

    const [{ chatCtx }] = requests.mock.calls[0] ?? [];
    const messages = messagesOf(chatCtx);
    // Only the Agent's instructions: no message from the User yet.
    expect(messages.map(({ role }) => role)).toEqual(['system']);
    expect(messages[0]?.text).toMatch(/"Hello, how can I help\?"$/);
  });
});
