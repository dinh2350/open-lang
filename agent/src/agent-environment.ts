import { z } from 'zod';

const agentEnvironmentSchema = z.object({
  // Read by the @livekit/agents CLI; validated here for a clear startup error.
  LIVEKIT_URL: z.url({ protocol: /^wss?$/ }),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  /** The Agent only joins rooms whose Room Token dispatches this name. */
  AGENT_NAME: z.string().min(1),
});

export type AgentEnvironment = z.infer<typeof agentEnvironmentSchema>;

export function loadAgentEnvironment(env: NodeJS.ProcessEnv): AgentEnvironment {
  const result = agentEnvironmentSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid Agent environment:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
