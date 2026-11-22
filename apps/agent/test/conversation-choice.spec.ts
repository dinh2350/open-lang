import { describe, expect, it } from 'vitest';
import { readConversationChoice } from '../src/conversation-choice.ts';

describe('readConversationChoice', () => {
  it('parses valid metadata', () => {
    expect(
      readConversationChoice(
        JSON.stringify({ scenarioId: 'one-on-one', speed: 0.85 }),
      ),
    ).toEqual({ scenarioId: 'one-on-one', speed: 0.85 });
  });

  it('throws on missing metadata', () => {
    expect(() => readConversationChoice('')).toThrow(/metadata/i);
  });

  it('throws on text that is not JSON', () => {
    expect(() => readConversationChoice('daily-standup')).toThrow(/JSON/);
  });

  it('throws on an unknown Scenario', () => {
    expect(() =>
      readConversationChoice(
        JSON.stringify({ scenarioId: 'job-interview', speed: 1 }),
      ),
    ).toThrow(/scenarioId/);
  });

  it('throws on a speed of 2', () => {
    expect(() =>
      readConversationChoice(
        JSON.stringify({ scenarioId: 'daily-standup', speed: 2 }),
      ),
    ).toThrow(/speed/);
  });
});
