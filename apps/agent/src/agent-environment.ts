import {
  type Environment,
  liveKitEnvSchema,
  parseEnv,
} from '@open-lang/shared';
import { z } from 'zod';

const HEADING = 'Invalid Agent environment';

/**
 * How the Agent reaches the backend, to which it sends the transcript of each
 * Conversation. AGENT_API_KEY is the backend's own AGENT_API_KEY.
 */
const backendEnvSchema = z.object({
  BACKEND_URL: z.url({ protocol: /^https?$/ }),
  AGENT_API_KEY: z.string().min(32),
});

export type BackendEnv = z.infer<typeof backendEnvSchema>;

const agentEnvSchema = liveKitEnvSchema.extend(backendEnvSchema.shape);

export type AgentEnv = z.infer<typeof agentEnvSchema>;

/**
 * How the Agent reaches the LiveKit server and the backend, and the name it
 * registers with. The @livekit/agents CLI reads the LiveKit variables itself;
 * they are validated here for a clear error at startup.
 */
export function loadAgentEnvironment(env: Environment): AgentEnv {
  return parseEnv(agentEnvSchema, env, HEADING);
}

/** The backend variables alone, which each job reads again. */
export function loadBackendEnvironment(env: Environment): BackendEnv {
  return parseEnv(backendEnvSchema, env, HEADING);
}
