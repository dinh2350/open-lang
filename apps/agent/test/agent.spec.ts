import { voice } from '@livekit/agents';
import { describe, expect, it } from 'vitest';
import { ConversationAgent } from '../src/agent.ts';

describe('ConversationAgent', () => {
  it('is a voice.Agent', () => {
    expect(new ConversationAgent()).toBeInstanceOf(voice.Agent);
  });

  it('answers in English, briefly, because its answers are spoken', () => {
    expect(new ConversationAgent().instructions).toBe(
      'You are a helpful general-purpose voice assistant. Always answer in English, briefly and clearly, because your answers are spoken aloud.',
    );
  });

  it('has no tools', () => {
    const { functionTools, providerTools, toolsets } = new ConversationAgent()
      .toolCtx;

    expect(Object.keys(functionTools)).toEqual([]);
    expect(providerTools).toEqual([]);
    expect(toolsets).toEqual([]);
  });
});
