import {
  grammarIssueSchema,
  type GrammarIssue,
  type ScenarioId,
} from '@open-lang/shared';
import { z } from 'zod';
import type { Role } from './resolve-misses.js';

export interface ReportInput {
  readonly scenarioId: ScenarioId;
  readonly transcript: readonly { role: Role; text: string }[];
  readonly missedTurnIndexes: readonly number[];
}

export interface ReportDraft {
  readonly listeningMisses: readonly {
    turnIndex: number;
    keyPhrases: string[];
    explanation: string;
  }[];
  readonly grammarIssues: readonly GrammarIssue[];
}

/** The injection token of the configured ReportModel. */
export const REPORT_MODEL = Symbol('REPORT_MODEL');

/** Writes the parts of a Report that need a language model. */
export interface ReportModel {
  draft(input: ReportInput): Promise<ReportDraft>;
}

/** How long a Provider request may take before it fails, in milliseconds. */
export const REPORT_REQUEST_TIMEOUT_MS = 60_000;

/** The model failed, or answered in a shape we cannot use. */
export class ReportModelError extends Error {}

const reportDraftSchema = z.object({
  listeningMisses: z.array(
    z.object({
      turnIndex: z.number().int().min(0),
      keyPhrases: z.array(z.string()),
      explanation: z.string(),
    }),
  ),
  grammarIssues: z.array(grammarIssueSchema),
});

const FENCE = '```';
const FENCE_LANGUAGE = 'json';

/** Removes a surrounding ``` or ```json code fence, if there is one. */
function unfence(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length < 2 * FENCE.length) return trimmed;
  if (!trimmed.startsWith(FENCE) || !trimmed.endsWith(FENCE)) return trimmed;

  const inner = trimmed.slice(FENCE.length, -FENCE.length).trimStart();
  const unlabelled = inner.toLowerCase().startsWith(FENCE_LANGUAGE)
    ? inner.slice(FENCE_LANGUAGE.length)
    : inner;
  return unlabelled.trim();
}

/**
 * Asks a Provider for its answer and reads it as a draft. A failed request,
 * such as a timeout, becomes a ReportModelError that keeps the original as its
 * `cause`; an empty answer is one too.
 */
export async function draftFromProvider(
  provider: string,
  ask: () => Promise<string | undefined>,
): Promise<ReportDraft> {
  let answer: string | undefined;
  try {
    answer = await ask();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    throw new ReportModelError(`${provider} report request failed: ${reason}`, {
      cause: error,
    });
  }
  if (!answer) {
    throw new ReportModelError(`${provider} returned an empty report.`);
  }
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

  const parsed = reportDraftSchema.safeParse(json);
  if (!parsed.success) {
    throw new ReportModelError(
      `The report model answered in the wrong shape: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
