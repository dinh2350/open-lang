import { inference, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { describe, expect, it } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';

const pipelineWithOpenAi = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'openai',
  LLM_PROVIDER: 'openai',
  TTS_PROVIDER: 'openai',
  OPENAI_API_KEY: 'test-key',
};

describe('Agent configuration in Pipeline mode with OpenAI for every step', () => {
  it('uses gpt-live-transcribe, gpt-6-luna and gpt-4o-mini-tts with the marin voice when no model is set', () => {
    expect(loadAgentConfig(pipelineWithOpenAi)).toEqual({
      agentMode: 'pipeline',
      stt: {
        provider: 'openai',
        model: 'gpt-live-transcribe',
        apiKey: 'test-key',
      },
      llm: { provider: 'openai', model: 'gpt-6-luna', apiKey: 'test-key' },
      tts: {
        provider: 'openai',
        model: 'gpt-4o-mini-tts',
        voice: 'marin',
        apiKey: 'test-key',
      },
    });
  });

  it("builds the OpenAI plugin's STT, LLM and TTS with their models, without connecting to OpenAI", () => {
    const options = createSessionOptions(loadAgentConfig(pipelineWithOpenAi));

    expect(options.stt).toBeInstanceOf(openai.STT);
    expect(options.stt).toHaveProperty('model', 'gpt-live-transcribe');
    expect(options.llm).toBeInstanceOf(openai.LLM);
    expect(options.llm).toHaveProperty('model', 'gpt-6-luna');
    expect(options.tts).toBeInstanceOf(openai.TTS);
    expect(options.tts).toHaveProperty('model', 'gpt-4o-mini-tts');
  });

  it('detects speech with Silero and turns with the local v1-mini turn detector, never LiveKit Inference', () => {
    const options = createSessionOptions(loadAgentConfig(pipelineWithOpenAi));

    expect(options.vad).toBeInstanceOf(inference.VAD);
    expect(options.vad).toHaveProperty('model', 'silero');
    expect(options.vad).toHaveProperty('provider', 'livekit-local-inference');
    expect(options.turnHandling?.turnDetection).toBeInstanceOf(
      inference.TurnDetector,
    );
    expect(options.turnHandling?.turnDetection).toHaveProperty(
      'model',
      'turn-detector-v1-mini',
    );
  });
});

describe('Agent configuration in Pipeline mode with any mix of OpenAI and the fake Provider', () => {
  /** What each step's Provider builds: a plugin class, or nothing at all. */
  const builtBy = {
    stt: { openai: openai.STT, fake: undefined },
    llm: { openai: openai.LLM, fake: voice.testing.FakeLLM },
    tts: { openai: openai.TTS, fake: undefined },
  } as const;

  it.each([
    ['openai', 'openai', 'openai'],
    ['openai', 'openai', 'fake'],
    ['openai', 'fake', 'openai'],
    ['openai', 'fake', 'fake'],
    ['fake', 'openai', 'openai'],
    ['fake', 'openai', 'fake'],
    ['fake', 'fake', 'openai'],
    ['fake', 'fake', 'fake'],
  ] as const)(
    'builds STT %s, LLM %s and TTS %s, with Silero and the v1-mini turn detector',
    (sttProvider, llmProvider, ttsProvider) => {
      const options = createSessionOptions(
        loadAgentConfig({
          ...pipelineWithOpenAi,
          STT_PROVIDER: sttProvider,
          LLM_PROVIDER: llmProvider,
          TTS_PROVIDER: ttsProvider,
        }),
      );

      expect(options.stt?.constructor).toBe(builtBy.stt[sttProvider]);
      expect(options.llm?.constructor).toBe(builtBy.llm[llmProvider]);
      expect(options.tts?.constructor).toBe(builtBy.tts[ttsProvider]);
      expect(options.vad).toBeInstanceOf(inference.VAD);
      expect(options.turnHandling?.turnDetection).toHaveProperty(
        'model',
        'turn-detector-v1-mini',
      );
    },
  );

  it('needs no API key when every step uses the fake Provider', () => {
    expect(
      loadAgentConfig({
        AGENT_MODE: 'pipeline',
        STT_PROVIDER: 'fake',
        LLM_PROVIDER: 'fake',
        TTS_PROVIDER: 'fake',
      }),
    ).toEqual({
      agentMode: 'pipeline',
      stt: { provider: 'fake', model: 'none' },
      llm: { provider: 'fake', model: 'fake-llm' },
      tts: { provider: 'fake', model: 'none' },
    });
  });
});
