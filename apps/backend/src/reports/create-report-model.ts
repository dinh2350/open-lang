import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { BackendEnv } from '../config/env.schema.js';
import { FakeReportModel } from './fake-report-model.js';
import { GoogleReportModel } from './google-report-model.js';
import { OpenAiReportModel } from './openai-report-model.js';
import type { ReportModel } from './report-model.js';

/** The part of the environment that picks and configures the ReportModel. */
export type ReportEnv = Pick<
  BackendEnv,
  'REPORT_PROVIDER' | 'REPORT_MODEL' | 'OPENAI_API_KEY' | 'GOOGLE_API_KEY'
>;

/**
 * The model each Provider uses when `REPORT_MODEL` is unset: the same ones as
 * the Agent's Pipeline language model (`DEFAULT_LLM_MODEL` in the Agent).
 */
export const DEFAULT_REPORT_MODEL = {
  openai: 'gpt-6-luna',
  google: 'gemini-3.8-flash',
} as const;

function requiredKey(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required to write Reports.`);
  return value;
}

/** Makes the ReportModel that `REPORT_PROVIDER` names. */
export function createReportModel(env: ReportEnv): ReportModel {
  switch (env.REPORT_PROVIDER) {
    case 'openai':
      return new OpenAiReportModel(
        new OpenAI({
          apiKey: requiredKey('OPENAI_API_KEY', env.OPENAI_API_KEY),
        }),
        env.REPORT_MODEL ?? DEFAULT_REPORT_MODEL.openai,
      );
    case 'google':
      return new GoogleReportModel(
        new GoogleGenAI({
          apiKey: requiredKey('GOOGLE_API_KEY', env.GOOGLE_API_KEY),
        }),
        env.REPORT_MODEL ?? DEFAULT_REPORT_MODEL.google,
      );
    case 'fake':
      return new FakeReportModel();
  }
}
