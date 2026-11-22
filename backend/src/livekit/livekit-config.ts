import {
  type Environment,
  liveKitEnvSchema,
  parseEnv,
} from '@open-live-agent/shared';

export interface LiveKitConfig {
  /** URL the browser uses to reach the LiveKit server. */
  readonly url: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  /** Name the Agent registers with; every Room Token dispatches it. */
  readonly agentName: string;
}

export const LIVEKIT_CONFIG = Symbol('LiveKitConfig');

export function loadLiveKitConfig(env: Environment): LiveKitConfig {
  const liveKitEnv = parseEnv(
    liveKitEnvSchema,
    env,
    'Invalid LiveKit settings in the backend environment',
  );
  return {
    url: liveKitEnv.LIVEKIT_URL,
    apiKey: liveKitEnv.LIVEKIT_API_KEY,
    apiSecret: liveKitEnv.LIVEKIT_API_SECRET,
    agentName: liveKitEnv.AGENT_NAME,
  };
}
