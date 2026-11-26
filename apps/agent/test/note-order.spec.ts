import { describe, expect, it } from 'vitest';
import { loadAgentConfig, noteOrderOf } from '../src/config/index.ts';

const geminiApiKey = { GOOGLE_API_KEY: 'test-key' };

describe('Where the tutor calls saveNote in its turn', () => {
  // Gemini Live closes a turn at a tool call, and the Node.js plugin takes
  // what follows, the end of that same turn, for a new one started by the
  // User: it cuts the tutor off while its audio, generated far faster than it
  // plays, is still playing. A call made before the tutor speaks cuts nothing.
  it('is before speaking on Gemini Live through the Gemini API', () => {
    const config = loadAgentConfig({
      AGENT_MODE: 'realtime',
      REALTIME_PROVIDER: 'google',
      ...geminiApiKey,
    });

    expect(noteOrderOf(config)).toBe('before-speaking');
  });

  it.each([
    [
      'Gemini Live on Vertex AI, which has no NON_BLOCKING tools',
      {
        AGENT_MODE: 'realtime',
        REALTIME_PROVIDER: 'google',
        GOOGLE_GENAI_USE_VERTEXAI: 'true',
        GOOGLE_CLOUD_PROJECT: 'test-project',
        GOOGLE_CLOUD_LOCATION: 'us',
      },
    ],
    [
      'OpenAI Realtime',
      {
        AGENT_MODE: 'realtime',
        REALTIME_PROVIDER: 'openai',
        OPENAI_API_KEY: 'test-key',
      },
    ],
    [
      'the fake Provider',
      { AGENT_MODE: 'realtime', REALTIME_PROVIDER: 'fake' },
    ],
    [
      'Pipeline mode with Google, whose model speaks only after the call',
      {
        AGENT_MODE: 'pipeline',
        STT_PROVIDER: 'google',
        LLM_PROVIDER: 'google',
        TTS_PROVIDER: 'google',
        ...geminiApiKey,
      },
    ],
  ])('is after speaking on %s', (_name, environment) => {
    expect(noteOrderOf(loadAgentConfig(environment))).toBe('after-speaking');
  });
});
