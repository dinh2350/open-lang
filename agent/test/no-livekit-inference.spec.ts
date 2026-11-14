import { inference, initializeLogger, type voice } from '@livekit/agents';
import { beforeAll, describe, expect, it } from 'vitest';
import { createSessionOptions, loadAgentConfig } from '../src/config/index.ts';

beforeAll(() => {
  // A job initializes the logger, which Google's models need.
  initializeLogger({ pretty: false, level: 'error' });
});

const credentials = {
  OPENAI_API_KEY: 'test-key',
  GOOGLE_API_KEY: 'test-key',
};

const providers = ['openai', 'google', 'fake'] as const;

/** A name for each configuration, and its environment. */
type Configuration = readonly [string, NodeJS.ProcessEnv];

const realtimeConfigurations = providers.map((provider): Configuration => [
  `Realtime mode with ${provider}`,
  { AGENT_MODE: 'realtime', REALTIME_PROVIDER: provider },
]);

const pipelineConfigurations = providers.flatMap((stt) =>
  providers.flatMap((llm) =>
    providers.map((tts): Configuration => [
      `Pipeline mode with STT ${stt}, LLM ${llm} and TTS ${tts}`,
      {
        AGENT_MODE: 'pipeline',
        STT_PROVIDER: stt,
        LLM_PROVIDER: llm,
        TTS_PROVIDER: tts,
      },
    ]),
  ),
);

/**
 * What the session's turn detection runs on: the realtime model's server,
 * nothing, or a turn detector model.
 */
function turnDetectionOf(options: voice.AgentSessionOptions): unknown {
  const turnDetection = options.turnHandling?.turnDetection;
  return turnDetection instanceof inference.TurnDetector
    ? turnDetection.model
    : turnDetection;
}

describe.each([...realtimeConfigurations, ...pipelineConfigurations])(
  'The Agent in %s',
  (_, agentMode) => {
    const options = () =>
      createSessionOptions(loadAgentConfig({ ...agentMode, ...credentials }));

    it('detects interruptions from voice activity, not with the adaptive detector, which calls LiveKit Inference', () => {
      expect(options().turnHandling?.interruption?.mode).toBe('vad');
    });

    it('detects turns on the realtime model, locally with v1-mini, or not at all, never with the cloud turn detector', () => {
      expect(['realtime_llm', 'turn-detector-v1-mini', null]).toContain(
        turnDetectionOf(options()),
      );
    });

    it("builds every model from a Provider's plugin, never from LiveKit Inference", () => {
      const { stt, llm, tts } = options();

      // A model name instead of a model would select LiveKit Inference.
      for (const model of [stt, llm, tts]) {
        expect(model).not.toBeTypeOf('string');
      }
      expect(stt).not.toBeInstanceOf(inference.STT);
      expect(llm).not.toBeInstanceOf(inference.LLM);
      expect(llm).not.toBeInstanceOf(inference.RealtimeModel);
      expect(tts).not.toBeInstanceOf(inference.TTS);
    });
  },
);
