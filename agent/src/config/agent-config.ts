import { type Environment, parseEnv } from '@livekit-platform/shared';
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

/**
 * Who serves the Agent's AI models: OpenAI or Google. The `fake` Provider
 * makes no AI calls and needs no key, so end-to-end tests run without them.
 */
export type Provider = 'openai' | 'google' | 'fake';

/** A Provider that makes AI calls. */
type RealProvider = Exclude<Provider, 'fake'>;

/**
 * Google's credentials, in the shape the plugin's options take: a Gemini API
 * key, or Vertex AI in a project and location.
 */
export type GoogleCredentials =
  | { readonly vertexai: false; readonly apiKey: string }
  | {
      readonly vertexai: true;
      readonly project: string;
      readonly location: string;
    };

/** What each Provider needs, besides a model name, to serve a model. */
interface ProviderSettings {
  openai: { readonly apiKey: string };
  google: { readonly credentials: GoogleCredentials };
  fake: object;
}

/** One of the Agent's models, and the Provider that serves it. */
export type ModelConfig<P extends Provider = Provider> = {
  [K in P]: {
    readonly provider: K;
    readonly model: string;
  } & ProviderSettings[K];
}[P];

/**
 * One of the Agent's models that speaks, with its voice. The fake Provider
 * says nothing, so it has no voice.
 */
export type SpeakingModelConfig<P extends Provider = Provider> = {
  [K in P]: ModelConfig<K> &
    (K extends RealProvider ? { readonly voice: string } : object);
}[P];

/** Realtime mode: one model listens and speaks. */
export interface RealtimeConfig {
  readonly agentMode: 'realtime';
  readonly realtime: SpeakingModelConfig;
}

/** Pipeline mode: separate models transcribe, think and speak. */
export interface PipelineConfig {
  readonly agentMode: 'pipeline';
  readonly stt: ModelConfig;
  readonly llm: ModelConfig;
  readonly tts: SpeakingModelConfig;
}

/** How the Agent talks: its Agent Mode, and each model with its Provider. */
export type AgentConfig = RealtimeConfig | PipelineConfig;

/** How the Agent turns the User's speech into its spoken reply. */
export type AgentMode = AgentConfig['agentMode'];

/** An empty variable, as copied from `.env.example`, counts as not set. */
function unsetIfEmpty(value: unknown): unknown {
  return value === '' ? undefined : value;
}

/** A model name that is never a deprecated model. */
function notDeprecated(name: string) {
  return z.string().check((ctx) => {
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

/** A model variable: its default when not set, and never a deprecated model. */
function modelVariable(name: string, defaultModel: string) {
  return z.preprocess(unsetIfEmpty, notDeprecated(name).default(defaultModel));
}

/**
 * A model variable the fake Provider ignores. It still never names a
 * deprecated model, so switching to a real Provider never brings one in.
 */
function ignoredModelVariable(name: string) {
  return z.preprocess(unsetIfEmpty, notDeprecated(name).optional());
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
 * Google's credentials. Vertex AI authenticates with Google's Application
 * Default Credentials. As in Google's own SDK, GOOGLE_GENAI_USE_VERTEXAI
 * chooses between them.
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
        .transform((env): GoogleCredentials => ({
          vertexai: false,
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
        .transform((env): GoogleCredentials => ({
          vertexai: true,
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

/** The variables that choose one of the Agent's models. */
interface ModelVariables {
  /** The variables' prefix, such as `STT` for STT_PROVIDER and STT_MODEL. */
  readonly prefix: string;
  /** Each real Provider's default model. */
  readonly defaultModels: Readonly<Record<RealProvider, string>>;
  /**
   * The model the fake Provider names in logs. Only the language model has a
   * framework fake (FakeLLM); a fake STT or TTS is no model at all.
   */
  readonly fakeModel: string;
}

/** The variables that choose one of the Agent's models that speaks. */
interface SpeakingModelVariables extends ModelVariables {
  /** Each real Provider's default voice, for the `<prefix>_VOICE` variable. */
  readonly defaultVoices: Readonly<Record<RealProvider, string>>;
}

/**
 * One of the Agent's models: `<prefix>_PROVIDER` chooses the Provider, and
 * `<prefix>_MODEL` the model, which defaults per Provider. Each model reads
 * its variables from the whole environment, so every bad model is reported at
 * once.
 */
function modelSchema({
  prefix,
  defaultModels,
  fakeModel,
}: ModelVariables): z.ZodType<ModelConfig> {
  const providerVariable = `${prefix}_PROVIDER`;
  const modelName = `${prefix}_MODEL`;
  return z.discriminatedUnion(
    providerVariable,
    [
      z
        .object({
          [providerVariable]: z.literal('openai'),
          [modelName]: modelVariable(modelName, defaultModels.openai),
          OPENAI_API_KEY: openAiApiKey(providerVariable),
        })
        .transform((env): ModelConfig<'openai'> => ({
          provider: 'openai',
          model: env[modelName],
          apiKey: env.OPENAI_API_KEY,
        })),
      z
        .looseObject({
          [providerVariable]: z.literal('google'),
          [modelName]: modelVariable(modelName, defaultModels.google),
        })
        .transform((env, ctx): ModelConfig<'google'> => ({
          provider: 'google',
          model: env[modelName],
          credentials: parseWithin(
            googleCredentials(providerVariable),
            env,
            ctx,
          ),
        })),
      z
        .object({
          [providerVariable]: z.literal('fake'),
          [modelName]: ignoredModelVariable(modelName),
        })
        .transform((): ModelConfig<'fake'> => ({
          provider: 'fake',
          model: fakeModel,
        })),
    ],
    {
      error: `${providerVariable} must be "openai", "google" or "fake"`,
    },
  );
}

/**
 * One of the Agent's models that speaks: a model, plus `<prefix>_VOICE`,
 * which defaults per Provider.
 */
function speakingModelSchema({
  defaultVoices,
  ...variables
}: SpeakingModelVariables): z.ZodType<SpeakingModelConfig> {
  const voiceName = `${variables.prefix}_VOICE`;
  const model = modelSchema(variables);
  return z
    .looseObject({
      [voiceName]: z.preprocess(unsetIfEmpty, z.string().optional()),
    })
    .transform((env, ctx): SpeakingModelConfig => {
      const chosen = parseWithin(model, env, ctx);
      return chosen.provider === 'fake'
        ? chosen
        : {
            ...chosen,
            voice: env[voiceName] ?? defaultVoices[chosen.provider],
          };
    });
}

const realtimeModelSchema = speakingModelSchema({
  prefix: 'REALTIME',
  defaultModels: DEFAULT_REALTIME_MODEL,
  defaultVoices: DEFAULT_REALTIME_VOICE,
  fakeModel: 'fake-llm',
});

const speechToTextSchema = modelSchema({
  prefix: 'STT',
  defaultModels: DEFAULT_STT_MODEL,
  fakeModel: 'none',
});

const languageModelSchema = modelSchema({
  prefix: 'LLM',
  defaultModels: DEFAULT_LLM_MODEL,
  fakeModel: 'fake-llm',
});

const textToSpeechSchema = speakingModelSchema({
  prefix: 'TTS',
  defaultModels: DEFAULT_TTS_MODEL,
  defaultVoices: DEFAULT_TTS_VOICE,
  fakeModel: 'none',
});

const realtimeSchema = z
  .looseObject({ AGENT_MODE: z.literal('realtime') })
  .transform((env, ctx): RealtimeConfig => ({
    agentMode: env.AGENT_MODE,
    realtime: parseWithin(realtimeModelSchema, env, ctx),
  }));

const pipelineSchema = z
  .looseObject({ AGENT_MODE: z.literal('pipeline') })
  .transform((env, ctx): PipelineConfig => ({
    agentMode: env.AGENT_MODE,
    stt: parseWithin(speechToTextSchema, env, ctx),
    llm: parseWithin(languageModelSchema, env, ctx),
    tts: parseWithin(textToSpeechSchema, env, ctx),
  }));

const agentConfigSchema = z.discriminatedUnion(
  'AGENT_MODE',
  [realtimeSchema, pipelineSchema],
  { error: 'AGENT_MODE must be "realtime" or "pipeline"' },
);

/**
 * Reads and validates the Agent's configuration from the environment. Throws
 * an error naming every bad variable, so the Agent refuses to start.
 */
export function loadAgentConfig(env: Environment): AgentConfig {
  return parseEnv(agentConfigSchema, env, 'Invalid Agent configuration');
}

/** One model of the Agent, as logged: who provides it, and which one. */
function modelOf({ provider, model }: ModelConfig) {
  return { provider, model };
}

/**
 * The Agent Mode, Providers and models to log, so a developer knows which
 * setup they are listening to. Picked field by field: never an API key.
 */
export function modelsOf(config: AgentConfig) {
  if (config.agentMode === 'realtime') {
    return { agentMode: config.agentMode, ...modelOf(config.realtime) };
  }
  return {
    agentMode: config.agentMode,
    stt: modelOf(config.stt),
    llm: modelOf(config.llm),
    tts: modelOf(config.tts),
  };
}
