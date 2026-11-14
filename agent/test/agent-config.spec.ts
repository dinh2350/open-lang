import { voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { describe, expect, it } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';

const realtimeWithOpenAi = {
  AGENT_MODE: 'realtime',
  REALTIME_PROVIDER: 'openai',
  OPENAI_API_KEY: 'test-key',
};

describe('Agent configuration in Realtime mode with OpenAI', () => {
  it('uses gpt-realtime-2.1 with the marin voice when REALTIME_MODEL and REALTIME_VOICE are not set', () => {
    expect(loadAgentConfig(realtimeWithOpenAi)).toEqual({
      agentMode: 'realtime',
      realtime: {
        provider: 'openai',
        model: 'gpt-realtime-2.1',
        voice: 'marin',
        apiKey: 'test-key',
      },
    });
  });

  it('uses the model set in REALTIME_MODEL', () => {
    const config = loadAgentConfig({
      ...realtimeWithOpenAi,
      REALTIME_MODEL: 'gpt-realtime-2.1-mini',
    });

    expect(config).toHaveProperty('realtime.model', 'gpt-realtime-2.1-mini');
  });

  it('uses the voice set in REALTIME_VOICE', () => {
    const config = loadAgentConfig({
      ...realtimeWithOpenAi,
      REALTIME_VOICE: 'cedar',
    });

    expect(config).toHaveProperty('realtime.voice', 'cedar');
  });

  it('treats empty optional variables, as copied from .env.example, as not set', () => {
    const config = loadAgentConfig({
      ...realtimeWithOpenAi,
      REALTIME_MODEL: '',
      REALTIME_VOICE: '',
    });

    expect(config).toEqual({
      agentMode: 'realtime',
      realtime: {
        provider: 'openai',
        model: 'gpt-realtime-2.1',
        voice: 'marin',
        apiKey: 'test-key',
      },
    });
  });

  it("builds the OpenAI plugin's realtime model, without connecting to OpenAI", () => {
    const options = createSessionOptions(
      loadAgentConfig({
        ...realtimeWithOpenAi,
        REALTIME_MODEL: 'gpt-realtime-2.1-mini',
      }),
    );

    expect(options.llm).toBeInstanceOf(openai.realtime.RealtimeModel);
    expect(options.llm).toHaveProperty('model', 'gpt-realtime-2.1-mini');
  });

  it("transcribes the User with gpt-live-transcribe, Pipeline mode's default, instead of the plugin's deprecated gpt-4o-mini-transcribe", () => {
    const options = createSessionOptions(loadAgentConfig(realtimeWithOpenAi));

    // The plugin has no public getter for its session settings.
    expect(options.llm).toHaveProperty('_options.inputAudioTranscription', {
      model: 'gpt-live-transcribe',
    });
  });

  it("leaves turn detection to OpenAI's server, with no local VAD and no LiveKit Inference", () => {
    const options = createSessionOptions(loadAgentConfig(realtimeWithOpenAi));

    expect(options.turnHandling?.turnDetection).toBe('realtime_llm');
    expect(options.vad).toBeNull();
  });
});

describe('Agent configuration refuses to start the Agent, naming the bad variable', () => {
  it.each([
    ['is not set', undefined],
    ['is unknown', 'duplex'],
  ])('when AGENT_MODE %s', (_, agentMode) => {
    expect(() =>
      loadAgentConfig({ ...realtimeWithOpenAi, AGENT_MODE: agentMode }),
    ).toThrow(
      /Invalid Agent configuration:[\s\S]*AGENT_MODE must be "realtime" or "pipeline"/,
    );
  });

  it.each([
    ['is not set', undefined],
    ['is unknown', 'azure'],
  ])('when REALTIME_PROVIDER %s', (_, provider) => {
    expect(() =>
      loadAgentConfig({ ...realtimeWithOpenAi, REALTIME_PROVIDER: provider }),
    ).toThrow('REALTIME_PROVIDER must be "openai", "google" or "fake"');
  });

  it.each([
    ['is not set', undefined],
    ['is empty', ''],
  ])('when OPENAI_API_KEY %s while OpenAI is selected', (_, apiKey) => {
    expect(() =>
      loadAgentConfig({ ...realtimeWithOpenAi, OPENAI_API_KEY: apiKey }),
    ).toThrow(/OPENAI_API_KEY is required when REALTIME_PROVIDER is "openai"/);
  });

  it.each([
    ['gpt-realtime', 'gpt-realtime-2.1'],
    ['gpt-realtime-2025-08-28', 'gpt-realtime-2.1'],
    ['gpt-realtime-mini', 'gpt-realtime-2.1-mini'],
    ['gpt-4o-realtime-preview', 'gpt-realtime-1.5'],
    // OpenAI names gpt-realtime-mini, itself deprecated, as its replacement.
    ['gpt-4o-mini-realtime-preview', 'gpt-realtime-2.1-mini'],
  ])(
    'when REALTIME_MODEL is %s, which OpenAI has deprecated, suggesting %s',
    (model, replacement) => {
      expect(() =>
        loadAgentConfig({ ...realtimeWithOpenAi, REALTIME_MODEL: model }),
      ).toThrow(
        `REALTIME_MODEL "${model}" is deprecated by its Provider; use "${replacement}"`,
      );
    },
  );
});

describe('Agent configuration in Realtime mode with the fake Provider', () => {
  const realtimeWithFake = {
    AGENT_MODE: 'realtime',
    REALTIME_PROVIDER: 'fake',
  };

  it('needs no API key and names its model fake-llm', () => {
    expect(loadAgentConfig(realtimeWithFake)).toEqual({
      agentMode: 'realtime',
      realtime: { provider: 'fake', model: 'fake-llm' },
    });
  });

  it('ignores the model set in REALTIME_MODEL', () => {
    expect(
      loadAgentConfig({
        ...realtimeWithFake,
        REALTIME_MODEL: 'gpt-realtime-2.1',
      }),
    ).toHaveProperty('realtime.model', 'fake-llm');
  });

  it('still refuses a deprecated REALTIME_MODEL, so switching to a real Provider never brings one in', () => {
    expect(() =>
      loadAgentConfig({ ...realtimeWithFake, REALTIME_MODEL: 'gpt-realtime' }),
    ).toThrow(
      'REALTIME_MODEL "gpt-realtime" is deprecated by its Provider; use "gpt-realtime-2.1"',
    );
  });

  it("uses the framework's FakeLLM, so the Agent makes no AI calls", () => {
    const options = createSessionOptions(loadAgentConfig(realtimeWithFake));

    expect(options.llm).toBeInstanceOf(voice.testing.FakeLLM);
  });

  it('turns off the VAD and the turn detector, which would load local models or call LiveKit Inference', () => {
    const options = createSessionOptions(loadAgentConfig(realtimeWithFake));

    expect(options.vad).toBeNull();
    expect(options.turnHandling?.turnDetection).toBeNull();
  });
});
