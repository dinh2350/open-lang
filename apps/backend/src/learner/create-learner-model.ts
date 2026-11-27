import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import type { BackendEnv } from '../config/env.schema.js';
import { FakeLearnerModel } from './fake-learner-model.js';
import { GoogleLearnerModel } from './google-learner-model.js';
import type { LearnerModel } from './learner-model.js';
import { OpenAiLearnerModel } from './openai-learner-model.js';

/** The part of the environment that picks and configures the LearnerModel. */
export type LearnerEnv = Pick<
  BackendEnv,
  'LEARNER_PROVIDER' | 'LEARNER_MODEL' | 'OPENAI_API_KEY' | 'GOOGLE_API_KEY'
>;

/**
 * The model each Provider uses when `LEARNER_MODEL` is unset: the same ones as
 * the Agent's Pipeline language model (`DEFAULT_LLM_MODEL` in the Agent).
 */
export const DEFAULT_LEARNER_MODEL = {
  openai: 'gpt-6-luna',
  google: 'gemini-3.8-flash',
} as const;

function requiredKey(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required to judge learner items.`);
  return value;
}

/** Makes the LearnerModel that `LEARNER_PROVIDER` names. */
export function createLearnerModel(env: LearnerEnv): LearnerModel {
  switch (env.LEARNER_PROVIDER) {
    case 'openai':
      return new OpenAiLearnerModel(
        new OpenAI({
          apiKey: requiredKey('OPENAI_API_KEY', env.OPENAI_API_KEY),
        }),
        env.LEARNER_MODEL ?? DEFAULT_LEARNER_MODEL.openai,
      );
    case 'google':
      return new GoogleLearnerModel(
        new GoogleGenAI({
          apiKey: requiredKey('GOOGLE_API_KEY', env.GOOGLE_API_KEY),
        }),
        env.LEARNER_MODEL ?? DEFAULT_LEARNER_MODEL.google,
      );
    case 'fake':
      return new FakeLearnerModel();
  }
}
