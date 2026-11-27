import { REPORT_REQUEST_TIMEOUT_MS } from '../reports/report-model.js';
import type { OpenAiClient } from '../reports/openai-report-model.js';
import {
  judgmentFromProvider,
  type LearnerJudgeInput,
  type LearnerJudgment,
  type LearnerModel,
} from './learner-model.js';
import { buildLearnerPrompt } from './learner-prompt.js';

/** Judges what the User recalled with an OpenAI model, through its Responses API. */
export class OpenAiLearnerModel implements LearnerModel {
  constructor(
    private readonly client: OpenAiClient,
    private readonly model: string,
    private readonly timeoutMs: number = REPORT_REQUEST_TIMEOUT_MS,
  ) {}

  judge(input: LearnerJudgeInput): Promise<LearnerJudgment> {
    const { system, user } = buildLearnerPrompt(input);
    return judgmentFromProvider('OpenAI', async () => {
      const response = await this.client.responses.create(
        {
          model: this.model,
          instructions: system,
          input: user,
          text: { format: { type: 'json_object' } },
        },
        // One attempt per call: the SDK would retry timeouts, 408, 409, 429
        // and 5xx twice by default, and the caller decides how often to ask.
        { timeout: this.timeoutMs, maxRetries: 0 },
      );
      return response.output_text;
    });
  }
}
