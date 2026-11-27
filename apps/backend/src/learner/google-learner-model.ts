import type { GoogleClient } from '../reports/google-report-model.js';
import { REPORT_REQUEST_TIMEOUT_MS } from '../reports/report-model.js';
import {
  judgmentFromProvider,
  type LearnerJudgeInput,
  type LearnerJudgment,
  type LearnerModel,
} from './learner-model.js';
import { buildLearnerPrompt } from './learner-prompt.js';

/** Judges what the User recalled with a Gemini model, through the Gemini API. */
export class GoogleLearnerModel implements LearnerModel {
  constructor(
    private readonly client: GoogleClient,
    private readonly model: string,
    private readonly timeoutMs: number = REPORT_REQUEST_TIMEOUT_MS,
  ) {}

  judge(input: LearnerJudgeInput): Promise<LearnerJudgment> {
    const { system, user } = buildLearnerPrompt(input);
    return judgmentFromProvider('Google', async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          // One attempt per call: without `retryOptions.attempts` the SDK
          // makes up to 5 (HttpRetryOptions), and the caller decides how
          // often to ask.
          httpOptions: {
            timeout: this.timeoutMs,
            retryOptions: { attempts: 1 },
          },
        },
      });
      return response.text;
    });
  }
}
