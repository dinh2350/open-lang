import { z } from 'zod';
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_REALTIME_MODEL,
  DEFAULT_REALTIME_VOICE,
  DEFAULT_STT_MODEL,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_VOICE,
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

/** The error for a Provider variable that names no known Provider. */
function unknownProvider(providerVariable: string) {
  return {
    error: `${providerVariable} must be "openai", "google" or "fake"`,
  };
}

/** A variable that a chosen setup needs; its error says which setup. */
function requiredVariable(name: string, requiredWhen: string) {
  return z.preprocess(
    unsetIfEmpty,
    z.string({ error: `${name} is required when ${requiredWhen}` }),
  );
}

/** The OpenAI API key, required whenever a Provider variable selects OpenAI. */
function openAiApiKey(providerVariable: string) {
  return requiredVariable('OPENAI_API_KEY', `${providerVariable} is "openai"`);
}

/**
 * Google's credentials, in the shape the plugin's options take: a Gemini API
 * key, or Vertex AI in a project and location. Vertex AI authenticates with
 * Google's Application Default Credentials. As in Google's own SDK,
 * GOOGLE_GENAI_USE_VERTEXAI chooses between them.
 */
function googleCredentials(providerVariable: string) {
  const selected = `${providerVariable} is "google"`;
  return z.discriminatedUnion(
    'GOOGLE_GENAI_USE_VERTEXAI',
    [
      z
        .object({
          GOOGLE_GENAI_USE_VERTEXAI: z.literal(['false', '']).optional(),
          GOOGLE_API_KEY: requiredVariable(
            'GOOGLE_API_KEY',
            `${selected}, unless GOOGLE_GENAI_USE_VERTEXAI is "true"`,
          ),
        })
        .transform((env) => ({
          vertexai: false as const,
          apiKey: env.GOOGLE_API_KEY,
        })),
      z
        .object({
          GOOGLE_GENAI_USE_VERTEXAI: z.literal('true'),
          GOOGLE_CLOUD_PROJECT: requiredVariable(
            'GOOGLE_CLOUD_PROJECT',
            `${selected} and GOOGLE_GENAI_USE_VERTEXAI is "true"`,
          ),
          GOOGLE_CLOUD_LOCATION: requiredVariable(
            'GOOGLE_CLOUD_LOCATION',
            `${selected} and GOOGLE_GENAI_USE_VERTEXAI is "true"`,
          ),
        })
        .transform((env) => ({
          vertexai: true as const,
          project: env.GOOGLE_CLOUD_PROJECT,
          location: env.GOOGLE_CLOUD_LOCATION,
        })),
    ],
    { error: 'GOOGLE_GENAI_USE_VERTEXAI must be "true" or "false"' },
  );
}

/**
 * Parses the environment with another schema inside a transform, and reports
 * its issues as the transform's own. zod rejects an intersection as a
 * discriminated-union option, so an option that needs a second schema parses
 * it here. On failure the result is never used.
 */
function parseWithin<T>(
  schema: z.ZodType<T>,
  env: unknown,
  ctx: z.RefinementCtx,
): T {
  const result = schema.safeParse(env);
  if (!result.success) {
    for (const { message, path, input } of result.error.issues) {
      ctx.addIssue({ code: 'custom', message, path, input });
    }
    return z.NEVER;
  }
  return result.data;
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
    OPENAI_API_KEY: openAiApiKey('REALTIME_PROVIDER'),
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

const googleRealtimeSchema = z
  .looseObject({
    ...realtimeMode,
    REALTIME_PROVIDER: z.literal('google'),
    REALTIME_MODEL: modelVariable(
      'REALTIME_MODEL',
      DEFAULT_REALTIME_MODEL.google,
    ),
    REALTIME_VOICE: z.preprocess(
      unsetIfEmpty,
      z.string().default(DEFAULT_REALTIME_VOICE.google),
    ),
  })
  .transform((env, ctx) => ({
    agentMode: env.AGENT_MODE,
    realtime: {
      provider: env.REALTIME_PROVIDER,
      model: env.REALTIME_MODEL,
      voice: env.REALTIME_VOICE,
      credentials: parseWithin(
        googleCredentials('REALTIME_PROVIDER'),
        env,
        ctx,
      ),
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
  [openAiRealtimeSchema, googleRealtimeSchema, fakeRealtimeSchema],
  unknownProvider('REALTIME_PROVIDER'),
);

/**
 * The fake Provider of a Pipeline step makes no AI calls and needs no key.
 * Only the language model has a framework fake (FakeLLM); a fake STT or TTS
 * is no model at all.
 */
const FAKE_STEP_MODEL = { stt: 'none', llm: 'fake-llm', tts: 'none' } as const;

const speechToTextSchema = z.discriminatedUnion(
  'STT_PROVIDER',
  [
    z
      .object({
        STT_PROVIDER: z.literal('openai'),
        STT_MODEL: modelVariable('STT_MODEL', DEFAULT_STT_MODEL.openai),
        OPENAI_API_KEY: openAiApiKey('STT_PROVIDER'),
      })
      .transform((env) => ({
        stt: {
          provider: env.STT_PROVIDER,
          model: env.STT_MODEL,
          apiKey: env.OPENAI_API_KEY,
        },
      })),
    z
      .looseObject({
        STT_PROVIDER: z.literal('google'),
        STT_MODEL: modelVariable('STT_MODEL', DEFAULT_STT_MODEL.google),
      })
      .transform((env, ctx) => ({
        stt: {
          provider: env.STT_PROVIDER,
          model: env.STT_MODEL,
          credentials: parseWithin(googleCredentials('STT_PROVIDER'), env, ctx),
        },
      })),
    z.object({ STT_PROVIDER: z.literal('fake') }).transform((env) => ({
      stt: { provider: env.STT_PROVIDER, model: FAKE_STEP_MODEL.stt },
    })),
  ],
  unknownProvider('STT_PROVIDER'),
);

const languageModelSchema = z.discriminatedUnion(
  'LLM_PROVIDER',
  [
    z
      .object({
        LLM_PROVIDER: z.literal('openai'),
        LLM_MODEL: modelVariable('LLM_MODEL', DEFAULT_LLM_MODEL.openai),
        OPENAI_API_KEY: openAiApiKey('LLM_PROVIDER'),
      })
      .transform((env) => ({
        llm: {
          provider: env.LLM_PROVIDER,
          model: env.LLM_MODEL,
          apiKey: env.OPENAI_API_KEY,
        },
      })),
    z
      .looseObject({
        LLM_PROVIDER: z.literal('google'),
        LLM_MODEL: modelVariable('LLM_MODEL', DEFAULT_LLM_MODEL.google),
      })
      .transform((env, ctx) => ({
        llm: {
          provider: env.LLM_PROVIDER,
          model: env.LLM_MODEL,
          credentials: parseWithin(googleCredentials('LLM_PROVIDER'), env, ctx),
        },
      })),
    z.object({ LLM_PROVIDER: z.literal('fake') }).transform((env) => ({
      llm: { provider: env.LLM_PROVIDER, model: FAKE_STEP_MODEL.llm },
    })),
  ],
  unknownProvider('LLM_PROVIDER'),
);

const textToSpeechSchema = z.discriminatedUnion(
  'TTS_PROVIDER',
  [
    z
      .object({
        TTS_PROVIDER: z.literal('openai'),
        TTS_MODEL: modelVariable('TTS_MODEL', DEFAULT_TTS_MODEL.openai),
        TTS_VOICE: z.preprocess(
          unsetIfEmpty,
          z.string().default(DEFAULT_TTS_VOICE.openai),
        ),
        OPENAI_API_KEY: openAiApiKey('TTS_PROVIDER'),
      })
      .transform((env) => ({
        tts: {
          provider: env.TTS_PROVIDER,
          model: env.TTS_MODEL,
          voice: env.TTS_VOICE,
          apiKey: env.OPENAI_API_KEY,
        },
      })),
    z
      .looseObject({
        TTS_PROVIDER: z.literal('google'),
        TTS_MODEL: modelVariable('TTS_MODEL', DEFAULT_TTS_MODEL.google),
        TTS_VOICE: z.preprocess(
          unsetIfEmpty,
          z.string().default(DEFAULT_TTS_VOICE.google),
        ),
      })
      .transform((env, ctx) => ({
        tts: {
          provider: env.TTS_PROVIDER,
          model: env.TTS_MODEL,
          voice: env.TTS_VOICE,
          credentials: parseWithin(googleCredentials('TTS_PROVIDER'), env, ctx),
        },
      })),
    z.object({ TTS_PROVIDER: z.literal('fake') }).transform((env) => ({
      tts: { provider: env.TTS_PROVIDER, model: FAKE_STEP_MODEL.tts },
    })),
  ],
  unknownProvider('TTS_PROVIDER'),
);

/**
 * The steps of Pipeline mode. Each step reads its own variables from the
 * whole environment, so every bad step is reported at once.
 */
const pipelineStepsSchema = z.intersection(
  speechToTextSchema,
  z.intersection(languageModelSchema, textToSpeechSchema),
);

const pipelineSchema = z
  .looseObject({ AGENT_MODE: z.literal('pipeline') })
  .transform((env, ctx) => ({
    agentMode: env.AGENT_MODE,
    ...parseWithin(pipelineStepsSchema, env, ctx),
  }));

const agentConfigSchema = z.discriminatedUnion(
  'AGENT_MODE',
  [realtimeSchema, pipelineSchema],
  { error: 'AGENT_MODE must be "realtime" or "pipeline"' },
);

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
