/**
 * Default model of each Provider in Realtime mode. Chosen from the Provider's
 * docs, not the plugin defaults: several plugin defaults are deprecated.
 */
export const DEFAULT_REALTIME_MODEL = {
  // Released 2026-07-06 on the GA Realtime API; OpenAI's replacement for the
  // plugin default `gpt-realtime`. https://developers.openai.com/api/docs/models/gpt-realtime-2.1
  openai: 'gpt-realtime-2.1',
} as const;

/** Default voice of each Provider in Realtime mode. */
export const DEFAULT_REALTIME_VOICE = {
  // The plugin's default, and one of OpenAI's two newest Realtime voices.
  openai: 'marin',
} as const;

/** Default speech-to-text model of each Provider in Pipeline mode. */
export const DEFAULT_STT_MODEL = {
  // OpenAI's recommended model for live transcription, and its replacement
  // for the deprecated whisper-1 and gpt-4o(-mini)-transcribe. Realtime mode
  // transcribes the User with it too.
  // https://developers.openai.com/api/docs/guides/realtime-transcription
  openai: 'gpt-live-transcribe',
} as const;

/** Default language model of each Provider in Pipeline mode. */
export const DEFAULT_LLM_MODEL = {
  // OpenAI's most efficient model, and its replacement for the plugin default
  // gpt-4.1. https://developers.openai.com/api/docs/models/gpt-6-luna
  openai: 'gpt-6-luna',
} as const;

/** Default text-to-speech model of each Provider in Pipeline mode. */
export const DEFAULT_TTS_MODEL = {
  // Deprecated, like every model of OpenAI's Speech API, which is the only API
  // the plugin's TTS can call. See the text-to-speech entry in DEPRECATIONS.
  openai: 'gpt-4o-mini-tts',
} as const;

/** Default voice of each Provider's text-to-speech in Pipeline mode. */
export const DEFAULT_TTS_VOICE = {
  // The Realtime default too, so both Agent Modes sound alike. OpenAI
  // recommends marin or cedar for the best quality.
  openai: 'marin',
} as const;

interface Deprecation {
  /** The day the Provider shuts the models down, or did. */
  readonly shutdown: string;
  /** The model to use instead. It is never itself deprecated. */
  readonly replacement: string;
  readonly models: readonly string[];
}

/**
 * Models their Provider has deprecated, grouped as the Provider announced
 * them. The Agent refuses to start with any of them. Keep this list current
 * with the Provider's docs.
 *
 * OpenAI: https://developers.openai.com/api/docs/deprecations (checked 2026-11-14).
 * Of its language models, only chat models shut down since 2026-07-23 or
 * later are listed; its coding, search and research models are left out.
 */
const DEPRECATIONS: readonly Deprecation[] = [
  // Realtime models
  {
    shutdown: '2025-10-10',
    replacement: 'gpt-realtime-1.5',
    models: ['gpt-4o-realtime-preview-2024-10-01'],
  },
  {
    shutdown: '2026-05-07',
    replacement: 'gpt-realtime-1.5',
    models: [
      'gpt-4o-realtime-preview',
      'gpt-4o-realtime-preview-2025-06-03',
      'gpt-4o-realtime-preview-2024-12-17',
    ],
  },
  {
    // OpenAI names gpt-realtime-mini, deprecated since, as the replacement.
    shutdown: '2026-05-07',
    replacement: 'gpt-realtime-2.1-mini',
    models: ['gpt-4o-mini-realtime-preview'],
  },
  {
    shutdown: '2026-07-23',
    replacement: 'gpt-realtime-2.1-mini',
    models: ['gpt-realtime-mini-2025-10-06'],
  },
  {
    shutdown: '2027-01-20',
    replacement: 'gpt-realtime-2.1',
    models: ['gpt-realtime', 'gpt-realtime-2025-08-28', 'gpt-4o-realtime'],
  },
  {
    shutdown: '2027-01-20',
    replacement: 'gpt-realtime-2.1-mini',
    models: [
      'gpt-realtime-mini',
      'gpt-realtime-mini-2025-12-15',
      'gpt-4o-mini-realtime',
    ],
  },

  // Speech-to-text models
  {
    // OpenAI names gpt-4o-mini-transcribe-2025-12-15, deprecated since, as
    // the replacement.
    shutdown: '2027-01-20',
    replacement: 'gpt-live-transcribe',
    models: ['gpt-4o-mini-transcribe-2025-03-20'],
  },
  {
    // OpenAI names gpt-live-transcribe or gpt-transcribe.
    shutdown: '2027-02-26',
    replacement: 'gpt-live-transcribe',
    models: [
      'whisper-1',
      'gpt-4o-transcribe',
      'gpt-4o-mini-transcribe',
      'gpt-4o-mini-transcribe-2025-12-15',
      'gpt-4o-transcribe-diarize',
    ],
  },

  // Text-to-speech models
  {
    // OpenAI deprecated every Speech API model, gpt-4o-mini-tts and its
    // snapshots too, all shutting down on 2027-01-06. It names
    // gpt-realtime-2.1-mini on the Realtime API as the replacement, which the
    // plugin's TTS can't call. So gpt-4o-mini-tts stays allowed, as the last
    // OpenAI model Pipeline mode can speak with, until a human decides
    // (ticket 05).
    shutdown: '2027-01-06',
    replacement: 'gpt-4o-mini-tts',
    models: ['tts-1', 'tts-1-hd'],
  },

  // Language models
  {
    shutdown: '2026-07-23',
    replacement: 'gpt-5.6-sol',
    models: ['gpt-5-chat-latest', 'gpt-5.1-chat-latest'],
  },
  {
    shutdown: '2026-08-10',
    replacement: 'gpt-5.6-sol',
    models: ['gpt-5.2-chat-latest', 'gpt-5.3-chat-latest'],
  },
  {
    shutdown: '2026-10-23',
    replacement: 'gpt-5.6-sol',
    models: [
      'gpt-4',
      'gpt-4-0613',
      'gpt-4-1106-preview',
      'gpt-4-turbo',
      'gpt-4-turbo-2024-04-09',
      'gpt-4o-2024-05-13',
      'o1',
      'o1-2024-12-17',
      'o3-mini',
      'o3-mini-2025-01-31',
    ],
  },
  {
    shutdown: '2026-10-23',
    replacement: 'gpt-5.6-terra',
    models: [
      'gpt-3.5-turbo',
      'gpt-3.5-turbo-0125',
      'o4-mini',
      'o4-mini-2025-04-16',
    ],
  },
  {
    shutdown: '2026-10-23',
    replacement: 'gpt-5.6-luna',
    models: ['gpt-4.1-nano', 'gpt-4.1-nano-2025-04-14'],
  },
  {
    shutdown: '2026-12-11',
    replacement: 'gpt-6.1-sol',
    models: [
      'gpt-5',
      'gpt-5-2025-08-07',
      'gpt-5-pro',
      'gpt-5-pro-2025-10-06',
      'o3',
      'o3-2025-04-16',
      'o3-pro',
      'o3-pro-2025-06-10',
    ],
  },
  {
    shutdown: '2026-12-11',
    replacement: 'gpt-6.1-terra',
    models: ['gpt-5-mini', 'gpt-5-mini-2025-08-07'],
  },
  {
    shutdown: '2026-12-11',
    replacement: 'gpt-6-luna',
    models: ['gpt-5-nano', 'gpt-5-nano-2025-08-07'],
  },
  {
    // OpenAI lists the dated snapshots; each alias points to one of them.
    shutdown: '2027-01-14',
    replacement: 'gpt-6-luna',
    models: [
      'gpt-4o',
      'gpt-4o-2024-08-06',
      'gpt-4o-2024-11-20',
      'gpt-4o-mini',
      'gpt-4o-mini-2024-07-18',
      'gpt-4.1',
      'gpt-4.1-2025-04-14',
      'gpt-4.1-mini',
      'gpt-4.1-mini-2025-04-14',
    ],
  },
  {
    shutdown: '2027-04-01',
    replacement: 'gpt-6-sol',
    models: ['gpt-5.1', 'gpt-5.1-2025-11-13'],
  },
  {
    shutdown: '2027-04-01',
    replacement: 'gpt-6-luna',
    models: ['gpt-5.4-nano', 'gpt-5.4-nano-2026-03-17'],
  },
];

/** The Provider's deprecation notice for a model, if it has one. */
export function deprecationOf(model: string): Deprecation | undefined {
  return DEPRECATIONS.find((deprecation) => deprecation.models.includes(model));
}
