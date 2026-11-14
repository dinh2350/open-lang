/** The SonarQube project that every checkout of this repo scans into. */
export const SONAR_PROJECT = {
  key: 'livekit-platform',
  name: 'LiveKit Platform',
} as const;

export interface GateCondition {
  readonly metric: string;
  /** SonarQube fails the condition when the value is `op` than `error`. */
  readonly op: 'GT' | 'LT';
  readonly error: string;
}

/** A rating worse than A (1) fails. */
const RATING_A = '1';

/**
 * The project's quality gate. Its conditions apply to overall code: in a
 * greenfield repo all code is new, and Community Build has no branch analysis.
 */
export const QUALITY_GATE = {
  name: 'LiveKit Platform Gate',
  conditions: [
    {
      metric: 'software_quality_reliability_rating',
      op: 'GT',
      error: RATING_A,
    },
    { metric: 'software_quality_security_rating', op: 'GT', error: RATING_A },
    {
      metric: 'software_quality_maintainability_rating',
      op: 'GT',
      error: RATING_A,
    },
    { metric: 'coverage', op: 'LT', error: '80' },
    { metric: 'duplicated_lines_density', op: 'GT', error: '3' },
    { metric: 'security_hotspots_reviewed', op: 'LT', error: '100' },
  ],
} as const satisfies {
  name: string;
  conditions: readonly GateCondition[];
};
