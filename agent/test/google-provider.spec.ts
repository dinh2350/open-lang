import assert from 'node:assert/strict';
import { initializeLogger, llm } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';
import { startFakeRealtimeApi } from './fake-realtime-api.ts';

beforeAll(() => {
  // A job initializes the logger, which Google's models need.
  initializeLogger({ pretty: false, level: 'error' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface GeminiRequest {
  url: string;
  apiKey: string | null;
  body: unknown;
}

/**
 * Stands in for the Gemini API: records each request and answers with a
 * one-word streamed reply.
 */
function fakeGeminiApi(): GeminiRequest[] {
  const requests: GeminiRequest[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((url, init) => {
    const body = init?.body;
    assert(typeof body === 'string', 'The Gemini client sends JSON text');
    requests.push({
      url: url instanceof Request ? url.url : url.toString(),
      apiKey: new Headers(init?.headers).get('x-goog-api-key'),
      body: JSON.parse(body),
    });
    const reply = {
      candidates: [
        {
          content: { role: 'model', parts: [{ text: 'Hello' }] },
          finishReason: 'STOP',
        },
      ],
    };
    return Promise.resolve(
      new Response(`data: ${JSON.stringify(reply)}\n\n`, {
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    );
  });
  return requests;
}

const geminiApiKey = { GOOGLE_API_KEY: 'test-key' };

const vertexAi = {
  GOOGLE_GENAI_USE_VERTEXAI: 'true',
  GOOGLE_CLOUD_PROJECT: 'test-project',
  GOOGLE_CLOUD_LOCATION: 'us',
};

const realtimeWithGoogle = {
  AGENT_MODE: 'realtime',
  REALTIME_PROVIDER: 'google',
  ...geminiApiKey,
};

describe('Agent configuration in Realtime mode with Google', () => {
  it('uses gemini-3.8-live with the Kore voice on the Gemini API when REALTIME_MODEL and REALTIME_VOICE are not set', () => {
    expect(loadAgentConfig(realtimeWithGoogle)).toEqual({
      agentMode: 'realtime',
      realtime: {
        provider: 'google',
        model: 'gemini-3.8-live',
        voice: 'Kore',
        credentials: { vertexai: false, apiKey: 'test-key' },
      },
    });
  });

  it("builds the Google plugin's realtime model on the Gemini API, without connecting to Google", () => {
    const options = createSessionOptions(
      loadAgentConfig({ ...realtimeWithGoogle, REALTIME_VOICE: 'Puck' }),
    );

    expect(options.llm).toBeInstanceOf(google.realtime.RealtimeModel);
    expect(options.llm).toHaveProperty('model', 'gemini-3.8-live');
    expect(options.llm).toHaveProperty('provider', 'Gemini');
  });

  it('connects to the Gemini Live API with the configured key, and asks for the configured voice', async () => {
    const liveApi = await startFakeRealtimeApi();
    onTestFinished(() => liveApi.close());
    // Google's SDK reads it when a session connects.
    vi.stubEnv('GOOGLE_GEMINI_BASE_URL', liveApi.baseUrl);
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });
    const options = createSessionOptions(
      loadAgentConfig({ ...realtimeWithGoogle, REALTIME_VOICE: 'Puck' }),
    );

    const connection = await liveApi.connect(options.llm);

    expect(
      new URL(connection.url, liveApi.baseUrl).searchParams.get('key'),
    ).toBe('test-key');
    expect(connection.firstMessage).toHaveProperty(
      'setup.model',
      'models/gemini-3.8-live',
    );
    expect(connection.firstMessage).toHaveProperty(
      'setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName',
      'Puck',
    );
  });

  it("leaves turn detection to Google's server, with no local VAD and no LiveKit Inference", () => {
    const options = createSessionOptions(loadAgentConfig(realtimeWithGoogle));

    expect(options.turnHandling?.turnDetection).toBe('realtime_llm');
    expect(options.vad).toBeNull();
  });
});

describe('Agent configuration in Realtime mode with Google on Vertex AI', () => {
  const realtimeOnVertexAi = {
    AGENT_MODE: 'realtime',
    REALTIME_PROVIDER: 'google',
    ...vertexAi,
  };

  it('needs no API key when GOOGLE_GENAI_USE_VERTEXAI is "true" with a project and location', () => {
    expect(loadAgentConfig(realtimeOnVertexAi)).toHaveProperty(
      'realtime.credentials',
      { vertexai: true, project: 'test-project', location: 'us' },
    );
  });

  it('prefers Vertex AI to a GOOGLE_API_KEY that is also set, as Google’s own SDK does', () => {
    expect(
      loadAgentConfig({ ...realtimeOnVertexAi, ...geminiApiKey }),
    ).toHaveProperty('realtime.credentials.vertexai', true);
  });

  it("builds the Google plugin's realtime model on Vertex AI, in the configured project and location", () => {
    const options = createSessionOptions(loadAgentConfig(realtimeOnVertexAi));

    expect(options.llm).toBeInstanceOf(google.realtime.RealtimeModel);
    expect(options.llm).toHaveProperty('model', 'gemini-3.8-live');
    expect(options.llm).toHaveProperty('provider', 'Vertex AI');
  });
});

const pipelineWithGoogle = {
  AGENT_MODE: 'pipeline',
  STT_PROVIDER: 'google',
  LLM_PROVIDER: 'google',
  TTS_PROVIDER: 'google',
  ...geminiApiKey,
};

describe('Agent configuration in Pipeline mode with Google for every step', () => {
  it('uses gemini-3.5-transcribe-live, gemini-3.8-flash and gemini-3.8-flash-lite-tts with the Kore voice when no model is set', () => {
    const credentials = { vertexai: false, apiKey: 'test-key' };

    expect(loadAgentConfig(pipelineWithGoogle)).toEqual({
      agentMode: 'pipeline',
      stt: {
        provider: 'google',
        model: 'gemini-3.5-transcribe-live',
        credentials,
      },
      llm: { provider: 'google', model: 'gemini-3.8-flash', credentials },
      tts: {
        provider: 'google',
        model: 'gemini-3.8-flash-lite-tts',
        voice: 'Kore',
        credentials,
      },
    });
  });

  it("builds the Google plugin's STT, LLM and TTS on the Gemini API, without connecting to Google", () => {
    const options = createSessionOptions(
      loadAgentConfig({ ...pipelineWithGoogle, TTS_VOICE: 'Puck' }),
    );

    expect(options.stt).toBeInstanceOf(google.beta.GeminiSTT);
    expect(options.stt).toHaveProperty('model', 'gemini-3.5-transcribe-live');
    expect(options.llm).toBeInstanceOf(google.LLM);
    expect(options.llm).toHaveProperty('model', 'gemini-3.8-flash');
    expect(options.llm).toHaveProperty('provider', 'Gemini');
    expect(options.tts).toBeInstanceOf(google.beta.TTS);
    expect(options.tts).toHaveProperty(
      'opts.model',
      'gemini-3.8-flash-lite-tts',
    );
    expect(options.tts).toHaveProperty('opts.voiceName', 'Puck');
    expect(options.tts).toHaveProperty('opts.vertexai', false);
  });

  it('asks the Gemini API, with the configured key, to think only a little, so spoken replies start quickly', async () => {
    const requests = fakeGeminiApi();
    const languageModel = createSessionOptions(
      loadAgentConfig(pipelineWithGoogle),
    ).llm;
    assert(languageModel instanceof llm.LLM);
    const chatCtx = llm.ChatContext.empty();
    chatCtx.addMessage({ role: 'user', content: 'Hello' });

    // Draining the reply sends the request.
    for await (const chunk of languageModel.chat({ chatCtx })) {
      expect(chunk).toBeDefined();
    }

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.url).toMatch(
      /^https:\/\/generativelanguage\.googleapis\.com\/.*\/models\/gemini-3\.8-flash:/,
    );
    expect(request.apiKey).toBe('test-key');
    expect(request.body).toHaveProperty(
      'generationConfig.thinkingConfig.thinkingLevel',
      'LOW',
    );
  });

  it('builds the LLM and TTS on Vertex AI, in the configured project and location', () => {
    const options = createSessionOptions(
      loadAgentConfig({
        ...pipelineWithGoogle,
        GOOGLE_API_KEY: undefined,
        ...vertexAi,
      }),
    );

    expect(options.llm).toHaveProperty('provider', 'Vertex AI');
    expect(options.tts).toHaveProperty('opts.vertexai', true);
    expect(options.tts).toHaveProperty('opts.project', 'test-project');
    expect(options.tts).toHaveProperty('opts.location', 'us');
  });
});

describe('Agent configuration in Pipeline mode with OpenAI transcribing and thinking, and Google speaking', () => {
  // Every OpenAI text-to-speech model shuts down on 2027-01-06 (ticket 05).
  const openAiWithGoogleSpeech = {
    AGENT_MODE: 'pipeline',
    STT_PROVIDER: 'openai',
    LLM_PROVIDER: 'openai',
    TTS_PROVIDER: 'google',
    OPENAI_API_KEY: 'test-openai-key',
    ...geminiApiKey,
  };

  it("gives each step its own Provider's default model and credentials", () => {
    expect(loadAgentConfig(openAiWithGoogleSpeech)).toEqual({
      agentMode: 'pipeline',
      stt: {
        provider: 'openai',
        model: 'gpt-live-transcribe',
        apiKey: 'test-openai-key',
      },
      llm: {
        provider: 'openai',
        model: 'gpt-6-luna',
        apiKey: 'test-openai-key',
      },
      tts: {
        provider: 'google',
        model: 'gemini-3.8-flash-lite-tts',
        voice: 'Kore',
        credentials: { vertexai: false, apiKey: 'test-key' },
      },
    });
  });

  it("builds OpenAI's STT and LLM with Google's TTS", () => {
    const options = createSessionOptions(
      loadAgentConfig(openAiWithGoogleSpeech),
    );

    expect(options.stt).toBeInstanceOf(openai.STT);
    expect(options.llm).toBeInstanceOf(openai.LLM);
    expect(options.tts).toBeInstanceOf(google.beta.TTS);
  });

  it('needs the Google credentials only for the step that uses Google', () => {
    expect(() =>
      loadAgentConfig({ ...openAiWithGoogleSpeech, GOOGLE_API_KEY: undefined }),
    ).toThrow(
      /^Invalid Agent configuration:\n✖ GOOGLE_API_KEY is required when TTS_PROVIDER is "google", unless GOOGLE_GENAI_USE_VERTEXAI is "true"\n {2}→ at GOOGLE_API_KEY$/,
    );
  });
});

describe('Agent configuration with Google refuses to start the Agent, naming the bad variable', () => {
  const realtimeWithoutCredentials = {
    AGENT_MODE: 'realtime',
    REALTIME_PROVIDER: 'google',
  };

  it.each([
    ['is not set', undefined],
    ['is empty', ''],
  ])('when GOOGLE_API_KEY %s and Vertex AI is not chosen', (_, apiKey) => {
    expect(() =>
      loadAgentConfig({
        ...realtimeWithoutCredentials,
        GOOGLE_API_KEY: apiKey,
      }),
    ).toThrow(
      'GOOGLE_API_KEY is required when REALTIME_PROVIDER is "google", unless GOOGLE_GENAI_USE_VERTEXAI is "true"',
    );
  });

  it.each(['GOOGLE_CLOUD_PROJECT', 'GOOGLE_CLOUD_LOCATION'])(
    'when %s is not set on Vertex AI',
    (variable) => {
      expect(() =>
        loadAgentConfig({
          ...realtimeWithoutCredentials,
          ...vertexAi,
          [variable]: undefined,
        }),
      ).toThrow(
        `${variable} is required when REALTIME_PROVIDER is "google" and GOOGLE_GENAI_USE_VERTEXAI is "true"`,
      );
    },
  );

  it.each(['1', 'TRUE', 'yes'])(
    'when GOOGLE_GENAI_USE_VERTEXAI is %s instead of "true" or "false"',
    (useVertexAi) => {
      expect(() =>
        loadAgentConfig({
          ...realtimeWithoutCredentials,
          ...vertexAi,
          GOOGLE_GENAI_USE_VERTEXAI: useVertexAi,
        }),
      ).toThrow('GOOGLE_GENAI_USE_VERTEXAI must be "true" or "false"');
    },
  );

  it.each([
    // The plugin's defaults on the Gemini API and on Vertex AI.
    [
      'REALTIME_MODEL',
      'gemini-2.5-flash-native-audio-preview-12-2025',
      'gemini-3.8-live',
    ],
    ['REALTIME_MODEL', 'gemini-live-2.5-flash-native-audio', 'gemini-3.8-live'],
    // The plugin's default, shutting down on 2026-12-18.
    ['TTS_MODEL', 'gemini-3.1-flash-tts-preview', 'gemini-3.8-flash-lite-tts'],
    ['TTS_MODEL', 'gemini-2.5-flash-preview-tts', 'gemini-3.8-flash-lite-tts'],
    // The plugin's fallback when no model is given.
    ['LLM_MODEL', 'gemini-2.0-flash-001', 'gemini-3.8-flash'],
    ['LLM_MODEL', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'],
    // The Gemini API routes it to gemini-3.6-flash, which Vertex AI retires.
    ['LLM_MODEL', 'gemini-3.5-flash', 'gemini-3.8-flash'],
    ['LLM_MODEL', 'gemini-3.6-flash', 'gemini-3.8-flash'],
  ])(
    'when %s is %s, which Google has deprecated, suggesting %s',
    (variable, model, replacement) => {
      const agentMode =
        variable === 'REALTIME_MODEL' ? realtimeWithGoogle : pipelineWithGoogle;

      expect(() =>
        loadAgentConfig({ ...agentMode, [variable]: model }),
      ).toThrow(
        `${variable} "${model}" is deprecated by its Provider; use "${replacement}"`,
      );
    },
  );
});
