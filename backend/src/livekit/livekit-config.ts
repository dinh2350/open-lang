import { z } from 'zod';

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
  const result = liveKitEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid LiveKit settings in the backend environment:\n${z.prettifyError(result.error)}`,
    );
  }
  return {
    url: result.data.LIVEKIT_URL,
    apiKey: result.data.LIVEKIT_API_KEY,
    apiSecret: result.data.LIVEKIT_API_SECRET,
    agentName: result.data.AGENT_NAME,
  };
}
