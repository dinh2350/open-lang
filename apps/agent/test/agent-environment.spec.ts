import { describe, expect, it } from 'vitest';
import { loadAgentEnvironment } from '../src/agent-environment.ts';

const validEnvironment = {
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
  AGENT_NAME: 'open-live-agent',
};

describe('Agent environment', () => {
  it('reads the LiveKit connection settings and the AGENT_NAME the Agent registers with', () => {
    expect(
      loadAgentEnvironment({ ...validEnvironment, UNRELATED: 'ignored' }),
    ).toEqual(validEnvironment);
  });

  it('accepts a secure wss:// LiveKit URL', () => {
    const environment = loadAgentEnvironment({
      ...validEnvironment,
      LIVEKIT_URL: 'wss://livekit.example.com',
    });

    expect(environment.LIVEKIT_URL).toBe('wss://livekit.example.com');
  });

  it.each([
    'LIVEKIT_URL',
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'AGENT_NAME',
  ])('refuses to start, naming %s, when it is missing', (name) => {
    const environment = Object.fromEntries(
      Object.entries(validEnvironment).filter(([key]) => key !== name),
    );

    expect(() => loadAgentEnvironment(environment)).toThrow(
      new RegExp(`Invalid Agent environment:[\\s\\S]*${name}`),
    );
  });

  it('refuses to start when AGENT_NAME is empty', () => {
    expect(() =>
      loadAgentEnvironment({ ...validEnvironment, AGENT_NAME: '' }),
    ).toThrow(/AGENT_NAME/);
  });

  it('refuses a LIVEKIT_URL that is not a WebSocket URL', () => {
    expect(() =>
      loadAgentEnvironment({
        ...validEnvironment,
        LIVEKIT_URL: 'http://localhost:7880',
      }),
    ).toThrow(/LIVEKIT_URL/);
  });
});
