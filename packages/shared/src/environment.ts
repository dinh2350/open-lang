import { z } from 'zod';

/** A process's environment variables. */
export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * Validates environment variables when a process starts. On failure it
 * throws an error that starts with `heading` and names every bad variable,
 * so the process refuses to start.
 */
export function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  env: Environment,
  heading: string,
): z.output<Schema> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`${heading}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/**
 * How the backend and the Agent reach the LiveKit server, and the name the
 * Agent registers with, which every Room Token dispatches.
 */
export const liveKitEnvSchema = z.object({
  LIVEKIT_URL: z.url({ protocol: /^wss?$/ }),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  AGENT_NAME: z.string().min(1),
});

export type LiveKitEnv = z.infer<typeof liveKitEnvSchema>;
