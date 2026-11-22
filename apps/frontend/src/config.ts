import { type Environment, parseEnv } from '@open-live-agent/shared';
import { z } from 'zod';

/** An empty variable, as copied from `.env.example`, counts as not set. */
function unsetIfEmpty(value: unknown): unknown {
  return value === '' ? undefined : value;
}

const frontendEnvSchema = z.object({
  VITE_AGENT_JOIN_TIMEOUT_MS: z.preprocess(
    unsetIfEmpty,
    z.coerce.number().int().positive().default(15_000),
  ),
});

/** The frontend's settings, read from Vite's environment when the app loads. */
export interface FrontendConfig {
  /**
   * How long a Conversation waits for the Agent to join and start listening
   * before it shows "Agent unavailable" and ends.
   */
  readonly agentJoinTimeoutMilliseconds: number;
}

/**
 * Reads the frontend's settings. Throws an error naming every bad variable,
 * so the app refuses to start.
 */
export function loadFrontendConfig(env: Environment): FrontendConfig {
  const { VITE_AGENT_JOIN_TIMEOUT_MS } = parseEnv(
    frontendEnvSchema,
    env,
    'Invalid frontend settings',
  );
  return { agentJoinTimeoutMilliseconds: VITE_AGENT_JOIN_TIMEOUT_MS };
}
