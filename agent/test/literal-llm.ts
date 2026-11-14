import { DEFAULT_API_CONNECT_OPTIONS, llm } from '@livekit/agents';

/**
 * A language model for tests that follows its instructions to the letter:
 * when the last line of its instructions ends with words in quotes, it says
 * exactly those words, and otherwise nothing. `voice.testing.FakeLLM` answers
 * only instructions that start with "instructions:", so it can't stand in
 * for a model following the Agent's own instructions for one reply.
 */
export class LiteralLLM extends llm.LLM {
  label(): string {
    return 'literal-llm';
  }

  chat({
    chatCtx,
    toolCtx,
    connOptions = DEFAULT_API_CONNECT_OPTIONS,
  }: Parameters<llm.LLM['chat']>[0]): llm.LLMStream {
    return new LiteralLLMStream(this, { chatCtx, toolCtx, connOptions });
  }
}

class LiteralLLMStream extends llm.LLMStream {
  protected run(): Promise<void> {
    const instructions = this.chatCtx.items.find(
      (item) => item instanceof llm.ChatMessage && item.role === 'system',
    );
    const lastLine =
      instructions instanceof llm.ChatMessage
        ? (instructions.textContent?.split('\n').at(-1) ?? '')
        : '';
    const quoted = /"([^"]+)"$/.exec(lastLine)?.[1];
    if (quoted !== undefined) {
      this.queue.put({
        id: 'literal',
        delta: { role: 'assistant', content: quoted },
      });
    }
    return Promise.resolve();
  }
}
