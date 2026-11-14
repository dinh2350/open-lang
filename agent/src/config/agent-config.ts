import { z } from 'zod';
import {
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  deprecationOf,
} from './models.ts';

/** An empty variable, as copied from `.env.example`, counts as not set. */
function unsetIfEmpty(value: unknown): unknown {
  return value === '' ? undefined : value;
}

/** A model variable: its default when not set, and never a deprecated model. */
function modelVariable(name: string, defaultModel: string) {
  return z
    .preprocess(unsetIfEmpty, z.string().default(defaultModel))
    .check((ctx) => {
      const deprecation = deprecationOf(ctx.value);
      if (deprecation) {
        ctx.issues.push({
          code: 'custom',
          input: ctx.value,
          message: `${name} "${ctx.value}" is deprecated by its Provider; use "${deprecation.replacement}" (shutdown: ${deprecation.shutdown})`,
        });
      }
    });
}

const realtimeMode = { AGENT_MODE: z.literal('realtime') };

const openAiRealtimeSchema = z
  .object({
    ...realtimeMode,
    REALTIME_PROVIDER: z.literal('openai'),
    REALTIME_MODEL: modelVariable(
      'REALTIME_MODEL',
      DEFAULT_REALTIME_MODEL.openai,
    ),
    REALTIME_VOICE: z.preprocess(
      unsetIfEmpty,
      z.string().default(DEFAULT_REALTIME_VOICE.openai),
    ),
    OPENAI_API_KEY: z.preprocess(
      unsetIfEmpty,
      z.string({
        error: 'OPENAI_API_KEY is required when REALTIME_PROVIDER is "openai"',
      }),
    ),
  })
  .transform((env) => ({
    agentMode: env.AGENT_MODE,
    realtime: {
      provider: env.REALTIME_PROVIDER,
      model: env.REALTIME_MODEL,
      voice: env.REALTIME_VOICE,
      apiKey: env.OPENAI_API_KEY,
    },
  }));

const fakeRealtimeSchema = z
  .object({ ...realtimeMode, REALTIME_PROVIDER: z.literal('fake') })
  .transform((env) => ({
    agentMode: env.AGENT_MODE,
    realtime: { provider: env.REALTIME_PROVIDER, model: 'fake-llm' as const },
  }));

const realtimeSchema = z.discriminatedUnion(
  'REALTIME_PROVIDER',
  [openAiRealtimeSchema, fakeRealtimeSchema],
  { error: 'REALTIME_PROVIDER must be "openai" or "fake"' },
);

/** Pipeline mode is a known Agent Mode that the Agent can't run yet. */
const pipelineModeSchema = z.object({ AGENT_MODE: z.literal('pipeline') });

const agentConfigSchema = z.discriminatedUnion('AGENT_MODE', [realtimeSchema], {
  error: (issue) =>
    pipelineModeSchema.safeParse(issue.input).success
      ? 'AGENT_MODE "pipeline" is not supported yet; use "realtime"'
      : 'AGENT_MODE must be "realtime"',
});

/** How the Agent talks: its Agent Mode, Provider and model. */
export type AgentConfig = z.infer<typeof agentConfigSchema>;

/**
 * Reads and validates the Agent's configuration from the environment. Throws
 * an error naming every bad variable, so the Agent refuses to start.
 */
export function loadAgentConfig(env: NodeJS.ProcessEnv): AgentConfig {
  const result = agentConfigSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Invalid Agent configuration:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
