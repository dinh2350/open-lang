import type { GenerateContentParameters } from '@google/genai';
import {
  draftFromProvider,
  REPORT_REQUEST_TIMEOUT_MS,
  type ReportDraft,
  type ReportInput,
  type ReportModel,
} from './report-model.js';
import { buildReportPrompt } from './report-prompt.js';

/** The part of the Google Gen AI SDK client that the model uses. */
export interface GoogleClient {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): PromiseLike<{ text: string | undefined }>;
  };
}

/** Writes a Report draft with a Gemini model, through the Gemini API. */
export class GoogleReportModel implements ReportModel {
  constructor(
    private readonly client: GoogleClient,
    private readonly model: string,
    private readonly timeoutMs: number = REPORT_REQUEST_TIMEOUT_MS,
  ) {}

  draft(input: ReportInput): Promise<ReportDraft> {
    const { system, user } = buildReportPrompt(input);
    return draftFromProvider('Google', async () => {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          // One attempt: without `retryOptions.attempts` the SDK makes up to
          // 5 (HttpRetryOptions). As with OpenAI, one run must end well
          // within the Report service's staleness window (120 000 ms).
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
