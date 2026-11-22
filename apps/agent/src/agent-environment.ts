import {
  type Environment,
  type LiveKitEnv,
  liveKitEnvSchema,
  parseEnv,
} from '@open-live-agent/shared';

/**
 * How the Agent reaches the LiveKit server, and the name it registers with.
 * The @livekit/agents CLI reads the LiveKit variables itself; they are
 * validated here for a clear error at startup.
 */
export function loadAgentEnvironment(env: Environment): LiveKitEnv {
  return parseEnv(liveKitEnvSchema, env, 'Invalid Agent environment');
}
