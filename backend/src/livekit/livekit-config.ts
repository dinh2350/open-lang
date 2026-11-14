import { z } from 'zod';
import { parseEnv } from '../config/parse-env.js';

const liveKitEnvSchema = z.object({
  LIVEKIT_URL: z.url({ protocol: /^wss?$/ }),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  AGENT_NAME: z.string().min(1),
});

export interface LiveKitConfig {
  /** URL the browser uses to reach the LiveKit server. */
  readonly url: string;
  readonly apiKey: string;
  readonly apiSecret: string;
  /** Name the Agent registers with; every Room Token dispatches it. */
  readonly agentName: string;
}

export const LIVEKIT_CONFIG = Symbol('LiveKitConfig');

export function loadLiveKitConfig(env: NodeJS.ProcessEnv): LiveKitConfig {
  const liveKitEnv = parseEnv('LiveKit', liveKitEnvSchema, env);
  return {
    url: liveKitEnv.LIVEKIT_URL,
    apiKey: liveKitEnv.LIVEKIT_API_KEY,
    apiSecret: liveKitEnv.LIVEKIT_API_SECRET,
    agentName: liveKitEnv.AGENT_NAME,
  };
}
