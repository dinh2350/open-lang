import type { voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import type { AgentConfig } from './agent-config.ts';
import { fakeProviderSessionOptions } from './fake-provider.ts';

/** Turns the Agent's configuration into the models of its AgentSession. */
export function createSessionOptions(
  config: AgentConfig,
): voice.AgentSessionOptions {
  if (config.realtime.provider === 'fake') {
    return fakeProviderSessionOptions();
  }
  const { model, voice, apiKey } = config.realtime;
  return {
    llm: new openai.realtime.RealtimeModel({ model, voice, apiKey }),
    // OpenAI's server detects when the User has finished speaking. Left
    // unset, AgentSession would also load a local Silero VAD and a turn
    // detector that calls LiveKit Inference.
    vad: null,
    turnHandling: { turnDetection: 'realtime_llm' },
  };
}
