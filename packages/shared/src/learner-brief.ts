import { z } from 'zod';
import { NOTE_LIMITS } from './note.ts';

/** The version of the brief the backend writes and the Agent reads. */
export const LEARNER_BRIEF_VERSION = 1;

/**
 * What the brief may hold: the most items, and the most bytes of its JSON
 * (the room metadata it travels in has a size limit).
 */
export const LEARNER_BRIEF_LIMITS = { items: 40, bytes: 4096 } as const;

/** Whether the Member is still learning an item or has mastered it. */
export const learnerItemStatusSchema = z.enum(['learning', 'mastered']);

export type LearnerItemStatus = z.infer<typeof learnerItemStatusSchema>;

/** One thing the Member keeps from their Notes: the English and what it means. */
export const learnerBriefItemSchema = z.object({
  /** The English to learn. */
  english: z.string().min(1).max(NOTE_LIMITS.english),
  /** What it means or why, in Vietnamese. */
  meaning: z.string().min(1).max(NOTE_LIMITS.meaning),
  status: learnerItemStatusSchema,
});

export type LearnerBriefItem = z.infer<typeof learnerBriefItemSchema>;

/** What the Agent is told about the Member before a Conversation starts. */
export const learnerBriefSchema = z.object({
  version: z.literal(LEARNER_BRIEF_VERSION),
  items: z.array(learnerBriefItemSchema).max(LEARNER_BRIEF_LIMITS.items),
});

export type LearnerBrief = z.infer<typeof learnerBriefSchema>;

/**
 * Read the brief out of the room metadata. It never throws: metadata that is
 * missing, is not JSON or does not match the contract gives `null`.
 */
export function parseLearnerBrief(
  metadata: string | undefined,
): LearnerBrief | null {
  let json: unknown;
  try {
    json = JSON.parse(metadata ?? '');
  } catch {
    return null;
  }
  const result = learnerBriefSchema.safeParse(json);
  return result.success ? result.data : null;
}
