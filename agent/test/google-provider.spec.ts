import { initializeLogger } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';

beforeAll(() => {
  // A job initializes the logger, which Google's realtime model needs.
  initializeLogger({ pretty: false, level: 'error' });
});

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
    // The plugin has no public getter for its session settings.
    expect(options.llm).toHaveProperty('_options.voice', 'Puck');
    expect(options.llm).toHaveProperty('_options.apiKey', 'test-key');
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
    // The plugin has no public getter for its session settings.
    expect(options.llm).toHaveProperty('_options.project', 'test-project');
    expect(options.llm).toHaveProperty('_options.location', 'us');
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
});
