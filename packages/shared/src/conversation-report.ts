import { z } from 'zod';
import { scenarioIdSchema, speedSchema } from './scenario.ts';

/** Where a Conversation's Report is: being written, ready to read, or failed. */
export const reportStatusSchema = z.enum(['generating', 'ready', 'failed']);

export type ReportStatus = z.infer<typeof reportStatusSchema>;

/** A moment the Member pressed "I did not catch that", with help to follow it. */
export const listeningMissSchema = z.object({
  /** What the Agent said that the Member did not catch. */
  agentText: z.string(),
  /** The words in `agentText` worth learning. */
  keyPhrases: z.array(z.string()),
  /** A short Vietnamese explanation of the sentence. */
  explanation: z.string(),
});

export type ListeningMiss = z.infer<typeof listeningMissSchema>;

/** One grammar mistake the Member made, with the fix. */
export const grammarIssueSchema = z.object({
  said: z.string(),
  corrected: z.string(),
  reason: z.string(),
});

export type GrammarIssue = z.infer<typeof grammarIssueSchema>;

/** How fluently the Member spoke. A number is null when it cannot be measured. */
export const fluencySchema = z.object({
  wordsPerMinute: z.number().nullable(),
  /** The Member's share of the speaking time, from 0 to 1. */
  talkRatio: z.number().min(0).max(1).nullable(),
  fillerWordsEstimate: z.number().int().min(0),
  longestTurnSeconds: z.number().nullable(),
});

export type Fluency = z.infer<typeof fluencySchema>;

/** The Report of one Conversation. At most five grammar issues. */
export const conversationReportSchema = z.object({
  listeningMisses: z.array(listeningMissSchema),
  grammarIssues: z.array(grammarIssueSchema).max(5),
  fluency: fluencySchema,
});

export type ConversationReport = z.infer<typeof conversationReportSchema>;

/** One Conversation in the Member's history list. */
export const conversationSummarySchema = z.object({
  roomName: z.string().min(1),
  scenarioId: scenarioIdSchema,
  speed: speedSchema,
  createdAt: z.iso.datetime(),
  durationSeconds: z.number().nullable(),
  reportStatus: reportStatusSchema.nullable(),
});

export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

/** Body of the response that lists the Member's Conversations. */
export const conversationListSchema = z.object({
  conversations: z.array(conversationSummarySchema),
});

export type ConversationList = z.infer<typeof conversationListSchema>;

/** One Conversation with its Report, which is null until the Report exists. */
export const conversationDetailSchema = conversationSummarySchema.extend({
  report: conversationReportSchema.nullable(),
});

export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

/**
 * Body the Agent sends to the backend for each finished turn. A turn that
 * has an end cannot end before it starts.
 */
export const turnIngestSchema = z
  .object({
    itemId: z.string().min(1),
    role: z.enum(['agent', 'user']),
    text: z.string().min(1),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime().optional(),
  })
  .refine(
    (turn) =>
      turn.endedAt === undefined ||
      Date.parse(turn.endedAt) >= Date.parse(turn.startedAt),
    { path: ['endedAt'], message: 'endedAt must be at or after startedAt.' },
  );

export type TurnIngest = z.infer<typeof turnIngestSchema>;

/** Body the Agent sends to the backend when the Member presses the help button. */
export const missIngestSchema = z.object({
  pressedAt: z.iso.datetime(),
});

export type MissIngest = z.infer<typeof missIngestSchema>;
