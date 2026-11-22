import type OpenAI from 'openai';
import {
  draftFromProvider,
  REPORT_REQUEST_TIMEOUT_MS,
  type ReportDraft,
  type ReportInput,
  type ReportModel,
} from './report-model.js';
import { buildReportPrompt } from './report-prompt.js';

/** The part of the OpenAI SDK client that the model uses. */
export interface OpenAiClient {
  responses: {
    create(
      body: OpenAI.Responses.ResponseCreateParamsNonStreaming,
      options: { timeout: number; maxRetries: number },
    ): PromiseLike<{ output_text: string }>;
  };
}

/** Writes a Report draft with an OpenAI model, through its Responses API. */
export class OpenAiReportModel implements ReportModel {
  constructor(
    private readonly client: OpenAiClient,
    private readonly model: string,
    private readonly timeoutMs: number = REPORT_REQUEST_TIMEOUT_MS,
  ) {}

  draft(input: ReportInput): Promise<ReportDraft> {
    const { system, user } = buildReportPrompt(input);
    return draftFromProvider('OpenAI', async () => {
      const response = await this.client.responses.create(
        {
          model: this.model,
          instructions: system,
          input: user,
          text: { format: { type: 'json_object' } },
        },
        // No SDK retries (it retries timeouts, 408, 409, 429 and 5xx twice by
        // default): the timeout is per attempt, and one run must end well
        // within the Report service's staleness window (120 000 ms), or a
        // second run could start while this one is still going. Asking for
        // the Report again is the retry.
        { timeout: this.timeoutMs, maxRetries: 0 },
      );
      return response.output_text;
    });
  }
}
