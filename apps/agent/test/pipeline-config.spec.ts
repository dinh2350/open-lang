import assert from 'node:assert/strict';
import { inference, initializeLogger, llm, voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Stands in for OpenAI's API: records the body of each request and answers
 * with an empty stream. Stub it before building the models: the OpenAI
 * client picks up `fetch` when it is created.
 */
function fakeOpenAiApi(): unknown[] {
  const requestBodies: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    const body = init?.body;
    assert(typeof body === 'string', 'The OpenAI client sends JSON text');
    requestBodies.push(JSON.parse(body));
    return Promise.resolve(
      new Response('data: [DONE]\n\n', {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
  });
  return requestBodies;
}

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
    const options = createSessionOptions(
      loadAgentConfig(pipelineWithOpenAi),
      1,
    );

    expect(options.stt).toBeInstanceOf(openai.STT);
    expect(options.stt).toHaveProperty('model', 'gpt-live-transcribe');
    expect(options.llm).toBeInstanceOf(openai.LLM);
    expect(options.llm).toHaveProperty('model', 'gpt-6-luna');
    expect(options.tts).toBeInstanceOf(openai.TTS);
    expect(options.tts).toHaveProperty('model', 'gpt-4o-mini-tts');
  });

  it('asks OpenAI to answer without reasoning, so spoken replies start quickly', async () => {
    initializeLogger({ pretty: false, level: 'error' });
    const requestBodies = fakeOpenAiApi();
    const languageModel = createSessionOptions(
      loadAgentConfig(pipelineWithOpenAi),
      1,
    ).llm;
    assert(languageModel instanceof llm.LLM);
    const chatCtx = llm.ChatContext.empty();
    chatCtx.addMessage({ role: 'user', content: 'Hello' });

    // Draining the reply sends the request.
    for await (const chunk of languageModel.chat({ chatCtx })) {
      expect(chunk).toBeDefined();
    }

    expect(requestBodies).toContainEqual(
      expect.objectContaining({
        model: 'gpt-6-luna',
        reasoning_effort: 'none',
      }),
    );
  });

  it('detects speech with Silero and turns with the local v1-mini turn detector, never LiveKit Inference', () => {
    const options = createSessionOptions(
      loadAgentConfig(pipelineWithOpenAi),
      1,
    );

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

  it('uses the models set in STT_MODEL, LLM_MODEL and TTS_MODEL, and the voice set in TTS_VOICE', () => {
    const options = createSessionOptions(
      loadAgentConfig({
        ...pipelineWithOpenAi,
        STT_MODEL: 'gpt-transcribe',
        LLM_MODEL: 'gpt-6.1-terra',
        TTS_MODEL: 'gpt-4o-mini-tts-2025-12-15',
        TTS_VOICE: 'cedar',
      }),
      1,
    );

    expect(options.stt).toHaveProperty('model', 'gpt-transcribe');
    expect(options.llm).toHaveProperty('model', 'gpt-6.1-terra');
    expect(options.tts).toHaveProperty('model', 'gpt-4o-mini-tts-2025-12-15');
  });

  it('treats empty model and voice variables, as copied from .env.example, as not set', () => {
    const config = loadAgentConfig({
      ...pipelineWithOpenAi,
      STT_MODEL: '',
      LLM_MODEL: '',
      TTS_MODEL: '',
      TTS_VOICE: '',
    });

    expect(config).toEqual(loadAgentConfig(pipelineWithOpenAi));
  });
});

describe('Agent configuration in Pipeline mode refuses to start the Agent, naming the bad variable', () => {
  it.each([
    ['STT_PROVIDER', 'is not set', undefined],
    ['STT_PROVIDER', 'is unknown', 'azure'],
    ['LLM_PROVIDER', 'is not set', undefined],
    ['LLM_PROVIDER', 'is unknown', 'azure'],
    ['TTS_PROVIDER', 'is not set', undefined],
    ['TTS_PROVIDER', 'is unknown', 'azure'],
  ])('when %s %s', (variable, _, provider) => {
    expect(() =>
      loadAgentConfig({ ...pipelineWithOpenAi, [variable]: provider }),
    ).toThrow(`${variable} must be "openai", "google" or "fake"`);
  });

  it.each(['STT_PROVIDER', 'LLM_PROVIDER', 'TTS_PROVIDER'])(
    'when OPENAI_API_KEY is not set while %s is "openai"',
    (variable) => {
      expect(() =>
        loadAgentConfig({
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'fake',
          LLM_PROVIDER: 'fake',
          TTS_PROVIDER: 'fake',
          [variable]: 'openai',
        }),
      ).toThrow(`OPENAI_API_KEY is required when ${variable} is "openai"`);
    },
  );

  it.each([
    ['STT_MODEL', 'gpt-4o-mini-transcribe', 'gpt-live-transcribe'],
    ['STT_MODEL', 'whisper-1', 'gpt-live-transcribe'],
    ['STT_MODEL', 'gpt-4o-transcribe', 'gpt-live-transcribe'],
    ['LLM_MODEL', 'gpt-4.1', 'gpt-6-luna'],
    ['LLM_MODEL', 'gpt-4o-mini', 'gpt-6-luna'],
    ['LLM_MODEL', 'gpt-5-mini', 'gpt-6.1-terra'],
    ['TTS_MODEL', 'tts-1', 'gpt-4o-mini-tts'],
    ['TTS_MODEL', 'tts-1-hd', 'gpt-4o-mini-tts'],
  ])(
    'when %s is %s, which OpenAI has deprecated, suggesting %s',
    (variable, model, replacement) => {
      expect(() =>
        loadAgentConfig({ ...pipelineWithOpenAi, [variable]: model }),
      ).toThrow(
        `${variable} "${model}" is deprecated by its Provider; use "${replacement}"`,
      );
    },
  );

  it('reports every bad step at once', () => {
    expect(() =>
      loadAgentConfig({
        AGENT_MODE: 'pipeline',
        STT_PROVIDER: 'openai',
        LLM_PROVIDER: 'azure',
        TTS_PROVIDER: 'fake',
      }),
    ).toThrow(
      /OPENAI_API_KEY is required when STT_PROVIDER is "openai"[\s\S]*LLM_PROVIDER must be "openai", "google" or "fake"/,
    );
  });
});

describe.each([
  ['a Gemini API key', { GOOGLE_API_KEY: 'test-google-key' }],
  [
    'Vertex AI',
    {
      GOOGLE_GENAI_USE_VERTEXAI: 'true',
      GOOGLE_CLOUD_PROJECT: 'test-project',
      GOOGLE_CLOUD_LOCATION: 'us',
    },
  ],
])(
  'Agent configuration in Pipeline mode with any mix of OpenAI, Google with %s, and the fake Provider',
  (_, googleCredentials) => {
    /** What each step's Provider builds: a plugin class, or nothing at all. */
    const builtBy = {
      stt: {
        openai: openai.STT,
        google: google.beta.GeminiSTT,
        fake: undefined,
      },
      llm: {
        openai: openai.LLM,
        google: google.LLM,
        fake: voice.testing.FakeLLM,
      },
      tts: { openai: openai.TTS, google: google.beta.TTS, fake: undefined },
    } as const;

    const providers = ['openai', 'google', 'fake'] as const;
    const everyMix = providers.flatMap((stt) =>
      providers.flatMap((llm) =>
        providers.map((tts) => [stt, llm, tts] as const),
      ),
    );

    it.each(everyMix)(
      'builds STT %s, LLM %s and TTS %s, with Silero and the v1-mini turn detector',
      (sttProvider, llmProvider, ttsProvider) => {
        const options = createSessionOptions(
          loadAgentConfig({
            ...pipelineWithOpenAi,
            ...googleCredentials,
            STT_PROVIDER: sttProvider,
            LLM_PROVIDER: llmProvider,
            TTS_PROVIDER: ttsProvider,
          }),
          1,
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
  },
);

describe('Agent configuration in Pipeline mode with only the fake Provider', () => {
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

  it.each([
    ['STT_MODEL', 'whisper-1', 'gpt-live-transcribe'],
    ['LLM_MODEL', 'gpt-4.1', 'gpt-6-luna'],
    ['TTS_MODEL', 'tts-1', 'gpt-4o-mini-tts'],
  ])(
    'still refuses a deprecated %s %s, suggesting %s, so switching to a real Provider never brings one in',
    (variable, model, replacement) => {
      expect(() =>
        loadAgentConfig({
          AGENT_MODE: 'pipeline',
          STT_PROVIDER: 'fake',
          LLM_PROVIDER: 'fake',
          TTS_PROVIDER: 'fake',
          [variable]: model,
        }),
      ).toThrow(
        `${variable} "${model}" is deprecated by its Provider; use "${replacement}"`,
      );
    },
  );
});
