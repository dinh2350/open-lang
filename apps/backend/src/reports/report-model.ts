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
