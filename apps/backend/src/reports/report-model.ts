import type { Note } from '@open-lang/shared';
import { z } from 'zod';
import { answerFromProvider, unfence } from './provider-answer.js';
import type { Role } from './turn-times.js';

/** What the model reads: the Conversation's turns, in order, and its Notes. */
export interface ReportInput {
  readonly transcript: readonly { role: Role; text: string }[];
  readonly notes: readonly Note[];
}

/**
 * What the model writes. It may be longer than a Report allows;
 * `composeReport` cuts it to the limits.
 */
export interface ReportDraft {
  readonly assessment: {
    readonly overview: string;
    readonly strengths: readonly string[];
    readonly improvements: readonly string[];
  };
}

/** The injection token of the configured ReportModel. */
export const REPORT_MODEL = Symbol('REPORT_MODEL');

/** Writes the parts of a Report that need a language model. */
export interface ReportModel {
  draft(input: ReportInput): Promise<ReportDraft>;
}

/**
 * How long a Provider request may take before it fails, in milliseconds. The
 * adapters make one attempt only, so a run takes at most this long. It must
 * stay below the Report service's staleness window (`GENERATING_TIMEOUT_MS`,
 * 120 000 ms), after which another run may start.
 */
export const REPORT_REQUEST_TIMEOUT_MS = 60_000;

/** The model failed, or answered in a shape we cannot use. */
export class ReportModelError extends Error {}

/** The model's answer. No limits here: an answer that is too long is cut, not refused. */
const assessmentAnswerSchema = z.object({
  overview: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

/**
 * Asks a Provider for its answer and reads it as a draft. A failed request,
 * such as a timeout, becomes a ReportModelError that keeps the original as its
 * `cause`; an empty answer is one too.
 */
export async function draftFromProvider(
  provider: string,
  ask: () => Promise<string | undefined>,
): Promise<ReportDraft> {
  const answer = await answerFromProvider(
    { provider, subject: 'report', errorClass: ReportModelError },
    ask,
  );
  return parseReportDraft(answer);
}

/** Reads the model's JSON answer, which may be wrapped in a code fence. */
export function parseReportDraft(text: string): ReportDraft {
  let json: unknown;
  try {
    json = JSON.parse(unfence(text));
  } catch {
    throw new ReportModelError('The report model did not answer with JSON.');
  }

  const parsed = assessmentAnswerSchema.safeParse(json);
  if (!parsed.success) {
    throw new ReportModelError(
      `The report model answered in the wrong shape: ${z.prettifyError(parsed.error)}`,
    );
  }
  return { assessment: parsed.data };
}
