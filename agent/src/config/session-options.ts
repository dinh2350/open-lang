import { ThinkingLevel } from '@google/genai';
import {
  inference,
  type llm,
  type stt,
  type tts,
  voice,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import type {
  AgentConfig,
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
 * Agent Mode or Provider uses LiveKit Inference.
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
      // Interruptions are detected from voice activity. Left unset, a session
      // with a VAD, a speech-to-text model and a turn detector uses adaptive
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
  /** Realtime mode's session options, around one model that listens and speaks. */
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
    realtime: ({ model, voice, credentials }) =>
      serverDetectsTurns(
        new google.realtime.RealtimeModel({ model, voice, ...credentials }),
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
