import type {
  LearnerJudgeInput,
  LearnerJudgment,
  LearnerModel,
} from './learner-model.js';

/** Decides a judgment itself: what a test puts in place of a real model. */
export type LearnerScript = (
  input: LearnerJudgeInput,
) => LearnerJudgment | Promise<LearnerJudgment>;

/**
 * A scripted LearnerModel for tests and for running without a real model.
 * With no script it judges nothing. The script may be replaced at any time.
 */
export class FakeLearnerModel implements LearnerModel {
  constructor(public script?: LearnerScript) {}

  async judge(input: LearnerJudgeInput): Promise<LearnerJudgment> {
    if (this.script === undefined) return { matches: [], outcomes: [] };
    return await this.script(input);
  }
}
