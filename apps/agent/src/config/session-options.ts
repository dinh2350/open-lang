import { Behavior, ThinkingLevel } from '@google/genai';
import {
  inference,
  type llm,
  type stt,
  type tts,
  voice,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import type { NoteOrder } from '../tutor-instructions.ts';
import type {
  AgentConfig,
  GoogleCredentials,
  ModelConfig,
  PipelineConfig,
  Provider,
  RealtimeConfig,
  SpeakingModelConfig,
} from './agent-config.ts';
import { fakeProviderSessionOptions } from './fake-provider.ts';
import { DEFAULT_STT_MODEL } from './models.ts';

/**
 * Turns the Agent's configuration into the models of its AgentSession. No
 * Agent Mode or Provider uses LiveKit Inference. The OpenAI realtime model
 * speaks at the normal speed; the User asks the tutor to slow down by voice
 * when they need it.
 */
export function createSessionOptions(
  config: AgentConfig,
): voice.AgentSessionOptions {
  const options =
    config.agentMode === 'realtime'
      ? realtimeSessionOptions(config)
      : pipelineSessionOptions(config);
  return {
    ...options,
    turnHandling: {
      ...options.turnHandling,
      // Interruptions are detected from voice activity. Left unset, an
      // AgentSession with a VAD, a speech-to-text model and a turn detector uses adaptive
      // interruption detection in dev mode, which calls LiveKit Inference.
      interruption: { mode: 'vad' },
    },
  };
}

function realtimeSessionOptions({
  realtime,
}: RealtimeConfig): voice.AgentSessionOptions {
  return pluginOf(realtime.provider).realtime(realtime);
}

/**
 * Pipeline mode: separate models transcribe, think and speak, each from its
 * own Provider. Speech and turns are detected locally on the CPU, without
 * LiveKit Inference.
 */
function pipelineSessionOptions(
  config: PipelineConfig,
): voice.AgentSessionOptions {
  // Silero, run by the framework's bundled local inference.
  const vad = new inference.VAD({ model: 'silero' });
  return {
    stt: pluginOf(config.stt.provider).stt(config.stt, vad),
    llm: pluginOf(config.llm.provider).llm(config.llm),
    tts: pluginOf(config.tts.provider).tts(config.tts),
    vad,
    // Pinned: left to choose, the detector picks LiveKit Inference's cloud
    // model in dev mode.
    turnHandling: {
      turnDetection: new inference.TurnDetector({ version: 'v1-mini' }),
    },
  };
}

/** What a Provider's plugin builds for each of the Agent's models. */
interface Plugin<P extends Provider> {
  /** Realtime mode's AgentSession options, around one model that listens and speaks. */
  realtime(config: SpeakingModelConfig<P>): voice.AgentSessionOptions;
  stt(config: ModelConfig<P>, vad: inference.VAD): stt.STT | undefined;
  llm(config: ModelConfig<P>): llm.LLM;
  tts(config: SpeakingModelConfig<P>): tts.TTS | undefined;
}

/** Each Provider's plugin. */
const PLUGINS: { readonly [P in Provider]: Plugin<P> } = {
  openai: {
    realtime: ({ model, voice, apiKey }) =>
      serverDetectsTurns(
        new openai.realtime.RealtimeModel({
          model,
          voice,
          apiKey,
          // Fixed: the pace never changes with the Conversation. The User
          // asks by voice to repeat or slow down.
          speed: 1,
          // The plugin's default, gpt-4o-mini-transcribe, is deprecated.
          inputAudioTranscription: { model: DEFAULT_STT_MODEL.openai },
        }),
      ),
    // OpenAI's live transcription models need a VAD to tell them when the
    // User stopped speaking. Sharing this one stops the plugin creating its
    // own.
    stt: ({ model, apiKey }, vad) => new openai.STT({ model, apiKey, vad }),
    llm: ({ model, apiKey }) =>
      new openai.LLM({
        model,
        apiKey,
        // OpenAI's current models reason at medium effort unless told
        // otherwise, which delays every spoken reply. The plugin turns
        // reasoning off only for the models it knows; gpt-6 models are newer.
        // Without reasoning, models such as gpt-6-luna can also call tools on
        // Chat Completions.
        reasoningEffort: 'none',
      }),
    tts: ({ model, voice, apiKey }) =>
      new openai.TTS({
        model,
        // The plugin's voice type predates voices such as marin and cedar,
        // which OpenAI's Speech API accepts.
        voice: voice as openai.TTSVoices,
        apiKey,
      }),
  },
  google: {
    // The Gemini Live API has no speaking-rate setting, and the plugin offers
    // none, so Gemini's pace comes from the instructions alone.
    realtime: ({ model, voice, credentials }) =>
      serverDetectsTurns(
        new google.realtime.RealtimeModel({
          model,
          voice,
          ...credentials,
          ...(declaresNonBlockingTools(credentials)
            ? { toolBehavior: Behavior.NON_BLOCKING }
            : {}),
        }),
      ),
    stt: ({ model, credentials }) =>
      new google.beta.GeminiSTT({ model, ...credentials }),
    llm: ({ model, credentials }) =>
      new google.LLM({
        model,
        ...credentials,
        // Gemini 3.8 Flash thinks at medium level unless told otherwise, which
        // delays every spoken reply. Low is its lowest level, which Google
        // suggests for fast chat.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      }),
    tts: ({ model, voice, credentials }) =>
      new google.beta.TTS({ model, voiceName: voice, ...credentials }),
  },
  // The fake Provider makes no AI calls. Its language model is the
  // framework's FakeLLM, which answers nothing; it transcribes nothing, and
  // speaks nothing, so the Agent's replies stay text.
  fake: {
    realtime: fakeProviderSessionOptions,
    stt: () => undefined,
    llm: () => new voice.testing.FakeLLM(),
    tts: () => undefined,
  },
};

/**
 * Whether the tools of Gemini Live are declared NON_BLOCKING, so that the
 * model keeps talking while a tool runs. The Node.js plugin leaves them
 * BLOCKING, unlike the Python one on Gemini 3.8 Live. Then Gemini stops at a
 * saveNote call and starts a new turn on its own once the result is in; the
 * SDK takes that for the User speaking, cuts the tutor off mid-word, and the
 * microphone stays closed while a call is unanswered, so the lesson goes
 * silent. Vertex AI does not support NON_BLOCKING.
 */
function declaresNonBlockingTools(credentials: GoogleCredentials): boolean {
  return !credentials.vertexai;
}

/**
 * Where the tutor calls saveNote in its turn. On Gemini Live it calls the
 * tool before it speaks: the plugin closes a turn at a tool call and takes
 * what follows, the end of that same turn, for a new turn started by the
 * User. It then cuts the tutor off while its audio, which Gemini generates
 * far faster than it plays, is still playing. A call made before the tutor
 * speaks has no audio to cut. Every other model speaks first and calls the
 * tool after.
 */
export function noteOrderOf(config: AgentConfig): NoteOrder {
  return config.agentMode === 'realtime' &&
    config.realtime.provider === 'google' &&
    declaresNonBlockingTools(config.realtime.credentials)
    ? 'before-speaking'
    : 'after-speaking';
}

function pluginOf<P extends Provider>(provider: P): Plugin<P> {
  return PLUGINS[provider];
}

/**
 * The realtime model's server detects when the User has finished speaking.
 * Left unset, AgentSession would also load a local Silero VAD and a turn
 * detector that calls LiveKit Inference.
 */
function serverDetectsTurns(
  realtimeModel: llm.RealtimeModel,
): voice.AgentSessionOptions {
  return {
    llm: realtimeModel,
    vad: null,
    turnHandling: { turnDetection: 'realtime_llm' },
  };
}
