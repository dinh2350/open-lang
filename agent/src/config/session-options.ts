import {
  inference,
  type llm,
  type stt,
  type tts,
  voice,
} from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as openai from '@livekit/agents-plugin-openai';
import type { AgentConfig } from './agent-config.ts';
import { fakeProviderSessionOptions } from './fake-provider.ts';
import { DEFAULT_STT_MODEL } from './models.ts';

type RealtimeConfig = Extract<AgentConfig, { agentMode: 'realtime' }>;
type PipelineConfig = Extract<AgentConfig, { agentMode: 'pipeline' }>;

/** Turns the Agent's configuration into the models of its AgentSession. */
export function createSessionOptions(
  config: AgentConfig,
): voice.AgentSessionOptions {
  return config.agentMode === 'realtime'
    ? realtimeSessionOptions(config)
    : pipelineSessionOptions(config);
}

function realtimeSessionOptions({
  realtime,
}: RealtimeConfig): voice.AgentSessionOptions {
  switch (realtime.provider) {
    case 'openai':
      return serverDetectsTurns(
        new openai.realtime.RealtimeModel({
          model: realtime.model,
          voice: realtime.voice,
          apiKey: realtime.apiKey,
          // The plugin's default, gpt-4o-mini-transcribe, is deprecated.
          inputAudioTranscription: { model: DEFAULT_STT_MODEL.openai },
        }),
      );
    case 'google':
      return serverDetectsTurns(
        new google.realtime.RealtimeModel({
          model: realtime.model,
          voice: realtime.voice,
          ...realtime.credentials,
        }),
      );
    case 'fake':
      return fakeProviderSessionOptions();
  }
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
    stt: speechToText(config.stt, vad),
    llm: languageModel(config.llm),
    tts: textToSpeech(config.tts),
    vad,
    // Pinned: left to choose, the detector picks LiveKit Inference's cloud
    // model in dev mode.
    turnHandling: {
      turnDetection: new inference.TurnDetector({ version: 'v1-mini' }),
    },
  };
}

/** The fake Provider transcribes nothing. */
function speechToText(
  config: PipelineConfig['stt'],
  vad: inference.VAD,
): stt.STT | undefined {
  if (config.provider === 'fake') {
    return undefined;
  }
  // OpenAI's live transcription models need a VAD to tell them when the User
  // stopped speaking. Sharing this one stops the plugin creating its own.
  return new openai.STT({ model: config.model, apiKey: config.apiKey, vad });
}

/** The fake Provider is the framework's FakeLLM, which answers nothing. */
function languageModel(config: PipelineConfig['llm']): llm.LLM {
  if (config.provider === 'fake') {
    return new voice.testing.FakeLLM();
  }
  return new openai.LLM({
    model: config.model,
    apiKey: config.apiKey,
    // OpenAI's current models reason at medium effort unless told otherwise,
    // which delays every spoken reply. The plugin turns reasoning off only for
    // the models it knows; gpt-6 models are newer. Without reasoning, models
    // such as gpt-6-luna can also call tools on Chat Completions.
    reasoningEffort: 'none',
  });
}

/** The fake Provider speaks nothing: the Agent's replies stay text. */
function textToSpeech(config: PipelineConfig['tts']): tts.TTS | undefined {
  if (config.provider === 'fake') {
    return undefined;
  }
  return new openai.TTS({
    model: config.model,
    // The plugin's voice type predates voices such as marin and cedar, which
    // OpenAI's Speech API accepts.
    voice: config.voice as openai.TTSVoices,
    apiKey: config.apiKey,
  });
}
