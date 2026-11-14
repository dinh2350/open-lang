import { voice } from '@livekit/agents';

/**
 * Session options for the `fake` Provider. It needs no API keys and makes no
 * network calls, so the end-to-end smoke test runs without real AI calls.
 * The Agent joins the room and runs its session; it doesn't speak.
 */
export function fakeProviderSessionOptions(): voice.AgentSessionOptions {
  return {
    llm: new voice.testing.FakeLLM(),
    // Left unset, AgentSession creates a local Silero VAD and a turn detector
    // that may call LiveKit Inference. Neither is needed without speech input.
    vad: null,
    turnHandling: { turnDetection: null },
  };
}
