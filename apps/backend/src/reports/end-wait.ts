/**
 * How the Report waits for the Agent's end marker before it reads a
 * Conversation. The default is `defaultEndWait` in report.service.ts.
 */
export interface EndWait {
  /** The longest wait, in milliseconds from the moment the Report was claimed. */
  readonly timeoutMs: number;
  /** How often the Conversation is read again while waiting, in milliseconds. */
  readonly pollMs: number;
}

/** The injection token of the EndWait the Report service uses. */
export const REPORT_END_WAIT = Symbol('REPORT_END_WAIT');
