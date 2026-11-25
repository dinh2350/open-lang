import {
  conversationDetailSchema,
  conversationSummarySchema,
  MAX_NOTES_PER_CONVERSATION,
  type ConversationDetail,
  type ConversationSummary,
  type Note,
  type ReportStatus,
  type StoredNote,
  type TurnIngest,
  type User,
} from '@open-lang/shared';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { conversationDurationSeconds } from '../reports/fluency.js';
import {
  readStoredReport,
  type ReadableReport,
  type StoredReportContent,
} from '../reports/stored-report.js';

/** What a Conversation's summary is made of. */
const summarySelect = {
  roomName: true,
  createdAt: true,
  turns: { select: { role: true, startedAt: true, endedAt: true } },
  // The content too: a ready Report whose content breaks the contract is shown as failed.
  report: { select: { status: true, content: true } },
} as const;

/** The Conversations of Users. */
@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Records a new Conversation of the User, in the room the Room Token names. */
  async create(user: User, roomName: string): Promise<void> {
    await this.prisma.conversation.create({
      data: { userId: user.id, roomName },
    });
  }

  /**
   * The User's Conversations, newest first. A Conversation the Agent recorded
   * no turn and no Note for is not a practice session, so it is left out.
   */
  async list(user: User): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        userId: user.id,
        OR: [{ turns: { some: {} } }, { notes: { some: {} } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: summarySelect,
    });
    return conversations.map((conversation) =>
      conversationSummarySchema.parse(
        summarize(conversation, this.reportOf(conversation)),
      ),
    );
  }

  /** The User's Conversation in the room, with its Report once it is ready. `404` when it is not the User's. */
  async get(user: User, roomName: string): Promise<ConversationDetail> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { roomName, userId: user.id },
      select: summarySelect,
    });
    if (conversation === null) {
      throw new NotFoundException('There is no Conversation in that room.');
    }
    const report = this.reportOf(conversation);
    return conversationDetailSchema.parse({
      ...summarize(conversation, report),
      report: report?.content ?? null,
    });
  }

  /** The Notes of the User's Conversation in the room, oldest first. `404` when it is not the User's. */
  async listNotes(user: User, roomName: string): Promise<StoredNote[]> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { roomName, userId: user.id },
      select: {
        notes: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            kind: true,
            english: true,
            said: true,
            meaning: true,
            createdAt: true,
          },
        },
      },
    });
    if (conversation === null) {
      throw new NotFoundException('There is no Conversation in that room.');
    }
    return conversation.notes.map(({ createdAt, ...note }) => ({
      ...note,
      createdAt: createdAt.toISOString(),
    }));
  }

  /**
   * The Conversation's Report as the User may see it, or null when none was
   * started. Stored content that breaks the contract reads as failed, so
   * asking again writes it anew; only the room is logged, never the content.
   */
  private reportOf(conversation: {
    readonly roomName: string;
    readonly report: StoredReportContent | null;
  }): ReadableReport | null {
    if (conversation.report === null) return null;
    const { broken, ...report } = readStoredReport(conversation.report);
    if (broken) {
      this.logger.warn(
        `The stored Report of room ${conversation.roomName} breaks the contract; it reads as failed.`,
      );
    }
    return report;
  }

  /**
   * Stores a finished turn of the Conversation in the room. The Agent may
   * send a turn again, so a turn with the same `itemId` is updated, not added.
   * A repeat that leaves out `endedAt` keeps the one stored.
   */
  async recordTurn(roomName: string, turn: TurnIngest): Promise<void> {
    const conversationId = await this.conversationIdOf(roomName);
    const times = {
      startedAt: new Date(turn.startedAt),
      endedAt: turn.endedAt === undefined ? undefined : new Date(turn.endedAt),
    };
    await this.prisma.turn.upsert({
      where: { conversationId_itemId: { conversationId, itemId: turn.itemId } },
      create: {
        conversationId,
        itemId: turn.itemId,
        role: turn.role,
        text: turn.text,
        ...times,
      },
      update: { text: turn.text, ...times },
    });
  }

  /**
   * Stores a Note of the Conversation in the room. The Agent may write a Note
   * again, so one with the same kind and English changes nothing. Once the
   * Conversation holds `MAX_NOTES_PER_CONVERSATION` Notes, the rest are ignored.
   */
  async recordNote(roomName: string, note: Note): Promise<void> {
    const conversationId = await this.conversationIdOf(roomName);
    const stored = await this.prisma.note.count({ where: { conversationId } });
    if (stored >= MAX_NOTES_PER_CONVERSATION) return;
    await this.prisma.note.upsert({
      where: {
        conversationId_kind_english: {
          conversationId,
          kind: note.kind,
          english: note.english,
        },
      },
      create: { conversationId, ...note },
      update: {},
    });
  }

  /**
   * Stores the end marker of the Conversation in the room: the Agent has sent
   * all it had. Only the first marker counts; a repeat changes nothing.
   */
  async recordEnd(roomName: string): Promise<void> {
    const { count } = await this.prisma.conversation.updateMany({
      where: { roomName, endedAt: null },
      data: { endedAt: new Date() },
    });
    if (count === 0) {
      // Ended already, or there is no such room: tell them apart.
      await this.conversationIdOf(roomName);
    }
  }

  /** `404` when no Conversation was created for the room. */
  private async conversationIdOf(roomName: string): Promise<string> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { roomName },
      select: { id: true },
    });
    if (conversation === null) {
      throw new NotFoundException('There is no Conversation in that room.');
    }
    return conversation.id;
  }
}

/** The fields of a ConversationSummary, before they are checked against the contract. */
function summarize(
  conversation: {
    readonly roomName: string;
    readonly createdAt: Date;
    readonly turns: readonly {
      role: 'agent' | 'user';
      startedAt: Date;
      endedAt: Date | null;
    }[];
  },
  report: { readonly status: ReportStatus } | null,
): Record<string, unknown> {
  return {
    roomName: conversation.roomName,
    createdAt: conversation.createdAt.toISOString(),
    durationSeconds: conversationDurationSeconds(conversation.turns),
    reportStatus: report?.status ?? null,
  };
}
