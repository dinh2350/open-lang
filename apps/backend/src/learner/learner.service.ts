import {
  LEARNER_BRIEF_LIMITS,
  LEARNER_BRIEF_VERSION,
  type LearnerBrief,
  type NoteKind,
} from '@open-lang/shared';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  LEARNER_MODEL,
  type LearnerJudgeInput,
  type LearnerJudgment,
  type LearnerModel,
} from './learner-model.js';
import {
  applyOutcome,
  newSchedule,
  normalizeKey,
  statusOf,
} from './spacing.js';

/** A Conversation with no end marker is taken as ended this long after it started. */
const UNMARKED_END_MS = 6 * 3_600_000;
/** The most items the model is asked about in one Conversation. */
const MAX_TRACKED_ITEMS = 60;
/** How many times the model is asked before the Conversation goes without a judgment. */
const JUDGE_ATTEMPTS = 3;

const NO_JUDGMENT: LearnerJudgment = { matches: [], outcomes: [] };

interface TrackedItem {
  readonly id: string;
  readonly english: string;
  readonly meaning: string;
  readonly intervalDays: number;
  readonly dueAt: Date;
}

interface StoredNote {
  readonly kind: NoteKind;
  readonly english: string;
  readonly meaning: string;
}

/** What one Conversation brings to the User's items. */
interface Lesson {
  readonly conversationId: string;
  readonly userId: string;
  /** When the Conversation took place. */
  readonly at: Date;
  readonly notes: readonly StoredNote[];
  readonly tracked: readonly TrackedItem[];
  readonly judgment: LearnerJudgment;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Keeps each User's learner items: what the tutor taught, and when to bring it back. */
@Injectable()
export class LearnerService implements OnModuleDestroy {
  private readonly logger = new Logger(LearnerService.name);
  /** The latest run of each User; a new run waits for it. */
  private readonly runs = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LEARNER_MODEL) private readonly model: LearnerModel,
  ) {}

  /**
   * Takes the User's ended Conversations that were not processed yet, oldest
   * first, into the User's items. Runs of one User go one at a time. Never
   * rejects: a failure is logged, and what it left unprocessed is taken by a
   * later run.
   */
  processPending(userId: string, now: Date = new Date()): Promise<void> {
    const previous = this.runs.get(userId) ?? Promise.resolve();
    const run = previous
      .then(() => this.processAll(userId, now))
      .catch((error: unknown) => {
        this.logger.error(
          `Could not update the learner profile of ${userId}: ${messageOf(error)}`,
        );
      })
      .finally(() => {
        // A later run that chained onto this one has taken its place.
        if (this.runs.get(userId) === run) this.runs.delete(userId);
      });
    this.runs.set(userId, run);
    return run;
  }

  /**
   * What the Agent is told about the User before a Conversation: the items
   * the User saw most recently, newest first, with whether each is still being
   * learned. It holds at most `LEARNER_BRIEF_LIMITS.items` items and its JSON
   * at most `LEARNER_BRIEF_LIMITS.bytes` bytes: the oldest items are left out
   * to fit. Rejects when the database fails, so the caller can go without it.
   */
  async briefFor(
    userId: string,
    now: Date = new Date(),
  ): Promise<LearnerBrief> {
    const stored = await this.prisma.learnerItem.findMany({
      where: { userId },
      orderBy: [{ lastSeenAt: 'desc' }, { id: 'asc' }],
      take: LEARNER_BRIEF_LIMITS.items,
      select: {
        english: true,
        meaning: true,
        intervalDays: true,
        dueAt: true,
      },
    });
    const items = stored.map(({ english, meaning, intervalDays, dueAt }) => ({
      english,
      meaning,
      status: statusOf({ intervalDays, dueAt }, now),
    }));
    const brief: LearnerBrief = { version: LEARNER_BRIEF_VERSION, items };
    while (
      items.length > 0 &&
      Buffer.byteLength(JSON.stringify(brief)) > LEARNER_BRIEF_LIMITS.bytes
    ) {
      items.pop();
    }
    return brief;
  }

  /** Waits for the runs in progress, so none is cut off by the shutdown. */
  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.runs.values());
  }

  private async processAll(userId: string, now: Date): Promise<void> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        userId,
        learnerUpdatedAt: null,
        AND: [
          { OR: [{ turns: { some: {} } }, { notes: { some: {} } }] },
          {
            OR: [
              { endedAt: { not: null } },
              { createdAt: { lt: new Date(now.getTime() - UNMARKED_END_MS) } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, createdAt: true },
    });
    for (const conversation of conversations) {
      const lesson = await this.lessonOf(
        userId,
        conversation.id,
        conversation.createdAt,
      );
      try {
        await this.apply(lesson, now);
      } catch (error) {
        // The later Conversations may depend on this one: they wait for the next run.
        this.logger.warn(
          `Could not update the learner profile from ${conversation.id}: ${messageOf(error)}`,
        );
        return;
      }
    }
  }

  /** Reads the Conversation and the items it may test, and asks the model about them. */
  private async lessonOf(
    userId: string,
    conversationId: string,
    at: Date,
  ): Promise<Lesson> {
    const [turns, notes, tracked] = await Promise.all([
      this.prisma.turn.findMany({
        where: { conversationId },
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        select: { role: true, text: true },
      }),
      this.prisma.note.findMany({
        where: { conversationId },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { kind: true, english: true, meaning: true },
      }),
      // Only what was seen before the Conversation can be recalled in it.
      this.prisma.learnerItem.findMany({
        where: { userId, lastSeenAt: { lt: at } },
        orderBy: [{ lastSeenAt: 'desc' }, { id: 'desc' }],
        take: MAX_TRACKED_ITEMS,
        select: {
          id: true,
          english: true,
          meaning: true,
          intervalDays: true,
          dueAt: true,
        },
      }),
    ]);
    const judgment =
      tracked.length === 0 || turns.length === 0
        ? NO_JUDGMENT
        : await this.judge(conversationId, {
            transcript: turns,
            notes: notes.map((note, index) => ({ index, ...note })),
            items: tracked.map(({ id, english, meaning }) => ({
              id,
              english,
              meaning,
            })),
          });
    return { conversationId, userId, at, notes, tracked, judgment };
  }

  /** The model's judgment, or none when every attempt failed. */
  private async judge(
    conversationId: string,
    input: LearnerJudgeInput,
  ): Promise<LearnerJudgment> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= JUDGE_ATTEMPTS; attempt++) {
      try {
        return await this.model.judge(input);
      } catch (error) {
        lastError = error;
      }
    }
    this.logger.warn(
      `The learner model could not judge ${conversationId}; its Notes are kept without a judgment: ${messageOf(lastError)}`,
    );
    return NO_JUDGMENT;
  }

  /**
   * Claims the Conversation and stores what it taught and tested, in one
   * transaction: a Conversation another run claimed first changes nothing.
   */
  private async apply(lesson: Lesson, now: Date): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const { count } = await transaction.conversation.updateMany({
        where: { id: lesson.conversationId, learnerUpdatedAt: null },
        data: { learnerUpdatedAt: now },
      });
      if (count === 0) return;
      const taughtAgain = await this.storeNotes(transaction, lesson);
      await this.storeOutcomes(transaction, lesson, taughtAgain);
    });
  }

  /**
   * Creates an item from each new Note. A Note with the key of an item, or
   * one the model matched to a tracked item, teaches that item again: only
   * when it was last seen moves. Returns the ids of the items taught again.
   */
  private async storeNotes(
    transaction: Prisma.TransactionClient,
    { userId, at, notes, tracked, judgment }: Lesson,
  ): Promise<Set<string>> {
    const trackedIds = new Set(tracked.map(({ id }) => id));
    const matched = new Map<number, string>();
    for (const { noteIndex, itemId } of judgment.matches) {
      const inRange = noteIndex >= 0 && noteIndex < notes.length;
      if (inRange && trackedIds.has(itemId) && !matched.has(noteIndex)) {
        matched.set(noteIndex, itemId);
      }
    }

    const keys = notes.map(({ english }) => normalizeKey(english));
    const existing = await transaction.learnerItem.findMany({
      where: { userId, key: { in: keys.filter((key) => key !== '') } },
      select: { id: true, key: true },
    });
    const idByKey = new Map(existing.map(({ id, key }) => [key, id]));

    const taughtAgain = new Set<string>();
    for (const [index, note] of notes.entries()) {
      const key = keys[index] ?? '';
      if (key === '') continue;
      const itemId = idByKey.get(key) ?? matched.get(index);
      if (itemId !== undefined) {
        taughtAgain.add(itemId);
        continue;
      }
      const created = await transaction.learnerItem.create({
        data: {
          userId,
          kind: note.kind === 'word' ? 'word' : 'phrase',
          english: note.english,
          meaning: note.meaning,
          key,
          firstSeenAt: at,
          lastSeenAt: at,
          ...newSchedule(at),
        },
        select: { id: true },
      });
      idByKey.set(key, created.id);
    }

    // Never move it back, should a later Conversation have taught it already.
    await transaction.learnerItem.updateMany({
      where: { id: { in: [...taughtAgain] }, lastSeenAt: { lt: at } },
      data: { lastSeenAt: at },
    });
    return taughtAgain;
  }

  /**
   * Applies the model's outcome to each tracked item it judged, once: the
   * first outcome for an item counts, and an item taught again in this
   * Conversation is not tested by it.
   */
  private async storeOutcomes(
    transaction: Prisma.TransactionClient,
    { at, tracked, judgment }: Lesson,
    taughtAgain: ReadonlySet<string>,
  ): Promise<void> {
    const trackedById = new Map(tracked.map((item) => [item.id, item]));
    const judged = new Set<string>();
    for (const { itemId, outcome } of judgment.outcomes) {
      const item = trackedById.get(itemId);
      if (item === undefined || judged.has(itemId)) continue;
      judged.add(itemId);
      if (taughtAgain.has(itemId)) continue;

      const { schedule, effect } = applyOutcome(item, outcome, at);
      await transaction.learnerItem.update({
        where: { id: itemId },
        data: {
          ...schedule,
          lastSeenAt: at,
          ...(effect === 'grew' && { correctRecalls: { increment: 1 } }),
          ...(effect === 'reset' && { lapses: { increment: 1 } }),
        },
      });
    }
  }
}
