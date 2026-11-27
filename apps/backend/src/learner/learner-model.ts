import type { NoteKind } from '@open-lang/shared';
import { z } from 'zod';
import { answerFromProvider, unfence } from '../reports/provider-answer.js';
import type { Role } from '../reports/turn-times.js';
import type { Outcome } from './spacing.js';

/**
 * What the model reads: the turns of one Conversation, in order, its Notes
 * numbered from 0, and the items the tutor is tracking for the User.
 */
export interface LearnerJudgeInput {
  readonly transcript: readonly { role: Role; text: string }[];
  readonly notes: readonly {
    index: number;
    kind: NoteKind;
    english: string;
    meaning: string;
  }[];
  readonly items: readonly { id: string; english: string; meaning: string }[];
}

/**
 * What the model decides. It may name ids and indexes it was not given;
 * whoever applies it ignores those.
 */
export interface LearnerJudgment {
  /** Notes that mean the same as a tracked item: the item was taught again. */
  readonly matches: readonly { noteIndex: number; itemId: string }[];
  /** How the User did with each tracked item that came up. */
  readonly outcomes: readonly { itemId: string; outcome: Outcome }[];
}

/** The injection token of the configured LearnerModel. */
export const LEARNER_MODEL = Symbol('LEARNER_MODEL');

/** Judges whether the User recalled what they were taught. */
export interface LearnerModel {
  judge(input: LearnerJudgeInput): Promise<LearnerJudgment>;
}

/** The model failed, or answered in a shape we cannot use. */
export class LearnerModelError extends Error {}

/**
 * A list the model leaves out or sends as null counts as empty: omitting an
 * empty list is the likeliest slip, and an empty list changes nothing.
 */
function listOf<Item extends z.ZodType>(item: Item) {
  return z
    .array(item)
    .nullish()
    .transform((items) => items ?? []);
}

const judgmentAnswerSchema = z.object({
  matches: listOf(z.object({ noteIndex: z.int(), itemId: z.string() })),
  outcomes: listOf(
    z.object({
      itemId: z.string(),
      outcome: z.enum(['recalled', 'missed']),
    }),
  ),
});

/**
 * Asks a Provider for its answer and reads it as a judgment. A failed request,
 * such as a timeout, becomes a LearnerModelError that keeps the original as
 * its `cause`; an empty answer is one too.
 */
export async function judgmentFromProvider(
  provider: string,
  ask: () => Promise<string | undefined>,
): Promise<LearnerJudgment> {
  const answer = await answerFromProvider(
    { provider, subject: 'judgment', errorClass: LearnerModelError },
    ask,
  );
  return parseLearnerJudgment(answer);
}

/** Reads the model's JSON answer, which may be wrapped in a code fence. */
export function parseLearnerJudgment(text: string): LearnerJudgment {
  let json: unknown;
  try {
    json = JSON.parse(unfence(text));
  } catch {
    throw new LearnerModelError('The learner model did not answer with JSON.');
  }

  const parsed = judgmentAnswerSchema.safeParse(json);
  if (!parsed.success) {
    throw new LearnerModelError(
      `The learner model answered in the wrong shape: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}
