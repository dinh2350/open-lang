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
 * OpenAI: https://developers.openai.com/api/docs/deprecations (checked 2026-11-14)
 */
const DEPRECATIONS: readonly Deprecation[] = [
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
];

/** The Provider's deprecation notice for a model, if it has one. */
export function deprecationOf(model: string): Deprecation | undefined {
  return DEPRECATIONS.find((deprecation) => deprecation.models.includes(model));
}
