import { setTimeout as sleep } from 'node:timers/promises';
import {
  conversationReportSchema,
  scenarioIdSchema,
  type ConversationReport,
  type ReportStatus,
  type User,
} from '@open-lang/shared';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { composeReport } from './compose-report.js';
import { REPORT_END_WAIT, type EndWait } from './end-wait.js';
import { REPORT_MODEL, type ReportModel } from './report-model.js';
import { resolveMisses } from './resolve-misses.js';
import { readStoredReport } from './stored-report.js';

/** A Report still generating after this long is taken as lost, and may be started again. */
const GENERATING_TIMEOUT_MS = 120_000;

/**
 * The longest a Report waits for the Agent's end marker, from its claim,
 * before it reads the Conversation anyway. The Agent posts the marker once
 * it has sent its last turns and Misses, a few seconds after the User leaves.
 * A run may then wait up to `REPORT_REQUEST_TIMEOUT_MS` (60 000 ms) for the
 * model, so the two must stay below `GENERATING_TIMEOUT_MS`: 15 s + 60 s <
 * 120 s, or a second run could start while the first still runs.
 */
export const END_MARKER_WAIT_MS = 15_000;

/** How often the Conversation is read while a Report waits for the end marker. */
export const END_MARKER_POLL_MS = 250;

/** The wait for the end marker that the app uses. */
export const defaultEndWait: EndWait = {
  timeoutMs: END_MARKER_WAIT_MS,
  pollMs: END_MARKER_POLL_MS,
};

interface StoredReport {
  readonly status: ReportStatus;
  readonly startedAt: Date;
  readonly content: unknown;
}

/** Writes the Reports of Conversations, in the background. */
@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REPORT_MODEL) private readonly model: ReportModel,
    @Inject(REPORT_END_WAIT) private readonly endWait: EndWait,
  ) {}

  /**
   * Starts the Report of the User's Conversation in the room and returns
   * its status at once; the Report is written in the background. A ready
   * Report, or one generated less than two minutes ago, is not started
   * again; a ready one whose content breaks the contract is. `404` when the
   * room is not the User's.
   */
  async start(user: User, roomName: string): Promise<ReportStatus> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { roomName, userId: user.id },
      select: {
        id: true,
        scenarioId: true,
        report: { select: { status: true, startedAt: true, content: true } },
      },
    });
    if (conversation === null) {
      throw new NotFoundException('There is no Conversation in that room.');
    }

    const { report } = conversation;
    if (report !== null && !this.canRestart(report)) return report.status;

    const claimedAt = new Date();
    if (!(await this.claim(conversation.id, report, claimedAt))) {
      // Another request claimed it first.
      return 'generating';
    }
    this.generate(conversation.id, conversation.scenarioId, claimedAt).catch(
      (error: unknown) => {
        this.logger.error(
          `Could not record the failure of the Report of ${conversation.id}.`,
          error instanceof Error ? error.stack : String(error),
        );
      },
    );
    return 'generating';
  }

  private canRestart(report: StoredReport): boolean {
    switch (report.status) {
      case 'ready':
        return readStoredReport(report).broken;
      case 'failed':
        return true;
      case 'generating':
        return Date.now() - report.startedAt.getTime() >= GENERATING_TIMEOUT_MS;
    }
  }

  /**
   * Marks the Report as generating, from the state this request saw. False
   * when another request changed it first, so two requests never both start.
   */
  private async claim(
    conversationId: string,
    seen: StoredReport | null,
    claimedAt: Date,
  ): Promise<boolean> {
    const generating = { status: 'generating', startedAt: claimedAt } as const;
    const { count } =
      seen === null
        ? await this.prisma.report.createMany({
            data: [{ conversationId, ...generating }],
            skipDuplicates: true,
          })
        : await this.prisma.report.updateMany({
            where: {
              conversationId,
              status: seen.status,
              startedAt: seen.startedAt,
            },
            data: { ...generating, content: Prisma.DbNull },
          });
    return count === 1;
  }

  /** Writes the Report and stores it; any failure stores `failed` instead. */
  private async generate(
    conversationId: string,
    scenarioId: string,
    claimedAt: Date,
  ): Promise<void> {
    try {
      await this.waitForEnd(conversationId, claimedAt);
      const content = checked(await this.write(conversationId, scenarioId));
      await this.finish(conversationId, claimedAt, 'ready', content);
    } catch (error) {
      this.logger.warn(
        `The Report of ${conversationId} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.finish(conversationId, claimedAt, 'failed');
    }
  }

  /**
   * Waits until the Agent has posted the Conversation's end marker, so the
   * last turns and Misses are stored, or until `endWait.timeoutMs` has passed
   * since the claim. It reads the Conversation every `endWait.pollMs`.
   */
  private async waitForEnd(
    conversationId: string,
    claimedAt: Date,
  ): Promise<void> {
    const deadline = claimedAt.getTime() + this.endWait.timeoutMs;
    while (!(await this.hasEnded(conversationId))) {
      const left = deadline - Date.now();
      if (left <= 0) return;
      await sleep(Math.min(this.endWait.pollMs, left));
    }
  }

  private async hasEnded(conversationId: string): Promise<boolean> {
    const { endedAt } = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      select: { endedAt: true },
    });
    return endedAt !== null;
  }

  /**
   * Builds the Report from the stored turns. The turns, the transcript the
   * model sees and the indexes of the missed turns all come from one array,
   * sorted by start time, never by arrival.
   */
  private async write(
    conversationId: string,
    scenarioId: string,
  ): Promise<ConversationReport> {
    const [turns, misses] = await Promise.all([
      this.prisma.turn.findMany({
        where: { conversationId },
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        select: { role: true, text: true, startedAt: true, endedAt: true },
      }),
      this.prisma.miss.findMany({
        where: { conversationId },
        select: { pressedAt: true },
      }),
    ]);
    if (turns.length === 0) {
      return composeReport([], [], { listeningMisses: [], grammarIssues: [] });
    }

    const missedTurnIndexes = resolveMisses(
      turns,
      misses.map((miss) => miss.pressedAt),
    );
    const draft = await this.model.draft({
      scenarioId: scenarioIdSchema.parse(scenarioId),
      transcript: turns.map(({ role, text }) => ({ role, text })),
      missedTurnIndexes,
    });
    return composeReport(turns, missedTurnIndexes, draft);
  }

  /** Stores the outcome, unless a newer run has taken the Report over meanwhile. */
  private async finish(
    conversationId: string,
    claimedAt: Date,
    status: 'ready' | 'failed',
    content?: ConversationReport,
  ): Promise<void> {
    await this.prisma.report.updateMany({
      where: { conversationId, status: 'generating', startedAt: claimedAt },
      data: { status, content },
    });
  }
}

/**
 * The composed Report, checked against its contract, so a Report that would
 * fail every read is stored as failed instead. The error never holds the
 * content.
 */
function checked(report: ConversationReport): ConversationReport {
  const parsed = conversationReportSchema.safeParse(report);
  if (!parsed.success) {
    throw new Error('The composed Report breaks the Report contract.');
  }
  return parsed.data;
}
