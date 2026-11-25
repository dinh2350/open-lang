import { z } from 'zod';

/** Where a Conversation's Report is: being written, ready to read, or failed. */
export const reportStatusSchema = z.enum(['generating', 'ready', 'failed']);

export type ReportStatus = z.infer<typeof reportStatusSchema>;

/**
 * How long the tutor's assessment may be, so the Member reads all of it: the
 * most characters of the overview and of each item, and the most items.
 */
export const ASSESSMENT_LIMITS = {
  overviewLength: 160,
  itemLength: 90,
  strengths: 2,
  improvements: 3,
} as const;

const assessmentItemSchema = z.string().max(ASSESSMENT_LIMITS.itemLength);

/** The tutor's short assessment of a Conversation, in Vietnamese. */
export const assessmentSchema = z.object({
  /** One or two short sentences; empty when there was too little to assess. */
  overview: z.string().max(ASSESSMENT_LIMITS.overviewLength),
  /** What the Member did well. */
  strengths: z.array(assessmentItemSchema).max(ASSESSMENT_LIMITS.strengths),
  /** What the Member should work on next. */
  improvements: z
    .array(assessmentItemSchema)
    .max(ASSESSMENT_LIMITS.improvements),
});

export type Assessment = z.infer<typeof assessmentSchema>;

/** How fluently the Member spoke. A number is null when it cannot be measured. */
export const fluencySchema = z.object({
  wordsPerMinute: z.number().nullable(),
  /** The Member's share of the speaking time, from 0 to 1. */
  talkRatio: z.number().min(0).max(1).nullable(),
  fillerWordsEstimate: z.number().int().min(0),
  longestTurnSeconds: z.number().nullable(),
});

export type Fluency = z.infer<typeof fluencySchema>;

/**
 * The Report of one Conversation: the tutor's assessment and the fluency
 * numbers. What the Member learned is in the Conversation's Notes.
 */
export const conversationReportSchema = z.object({
  assessment: assessmentSchema,
  fluency: fluencySchema,
});

export type ConversationReport = z.infer<typeof conversationReportSchema>;

/** One Conversation in the Member's history list. */
export const conversationSummarySchema = z.object({
  roomName: z.string().min(1),
  createdAt: z.iso.datetime(),
  durationSeconds: z.number().nullable(),
  reportStatus: reportStatusSchema.nullable(),
  /** How many Notes the Conversation has, so the Member sees which one holds something to look back at. */
  noteCount: z.number().int().min(0),
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
