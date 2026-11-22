import { voice } from '@livekit/agents';
import { SCENARIOS } from '@open-lang/shared';
import { describe, expect, it } from 'vitest';
import { ConversationAgent } from '../src/agent.ts';

const choice = { scenarioId: 'daily-standup', speed: 0.85 } as const;

describe('ConversationAgent', () => {
  it('is a voice.Agent', () => {
    expect(new ConversationAgent(choice)).toBeInstanceOf(voice.Agent);
  });

  it('plays the persona of the chosen Scenario at the chosen speed', () => {
    const { instructions } = new ConversationAgent(choice);

    expect(instructions).toContain(`You are ${SCENARIOS[0].personaName}`);
    expect(instructions).toContain('Speak slightly slower than normal');
  });

  it('has no tools', () => {
    const { functionTools, providerTools, toolsets } = new ConversationAgent(
      choice,
    ).toolCtx;

    expect(Object.keys(functionTools)).toEqual([]);
    expect(providerTools).toEqual([]);
    expect(toolsets).toEqual([]);
  });
});
