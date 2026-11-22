import {
  conversationDetailSchema,
  conversationSummarySchema,
  conversationReportSchema,
  type ConversationChoice,
  type ConversationDetail,
  type ConversationSummary,
  type MissIngest,
  type TurnIngest,
  type User,
} from '@open-lang/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { conversationDurationSeconds } from '../reports/fluency.js';

/** What a Conversation's summary is made of. */
const summarySelect = {
  roomName: true,
  scenarioId: true,
  speed: true,
  createdAt: true,
  turns: { select: { role: true, startedAt: true, endedAt: true } },
  report: { select: { status: true } },
} as const;

/** The Conversations of Users. */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Records a new Conversation of the User, in the room the Room Token names. */
  async create(
    user: User,
    roomName: string,
    choice: ConversationChoice,
  ): Promise<void> {
    await this.prisma.conversation.create({
      data: {
        userId: user.id,
        roomName,
        scenarioId: choice.scenarioId,
        speed: choice.speed,
      },
    });
  }

  /** The User's Conversations, newest first. */
  async list(user: User): Promise<ConversationSummary[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: summarySelect,
    });
    return conversations.map((conversation) =>
      conversationSummarySchema.parse(summarize(conversation)),
    );
  }

  /** The User's Conversation in the room, with its Report once it is ready. `404` when it is not the User's. */
  async get(user: User, roomName: string): Promise<ConversationDetail> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { roomName, userId: user.id },
      select: {
        ...summarySelect,
        report: { select: { status: true, content: true } },
      },
    });
    if (conversation === null) {
      throw new NotFoundException('There is no Conversation in that room.');
    }
    const { report } = conversation;
    const content =
      report?.status === 'ready' && report.content !== null
        ? conversationReportSchema.parse(report.content)
        : null;
    return conversationDetailSchema.parse({
      ...summarize(conversation),
      report: content,
    });
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

  /** Stores a press of "I did not catch that" in the Conversation in the room. */
  async recordMiss(roomName: string, miss: MissIngest): Promise<void> {
    await this.prisma.miss.create({
      data: {
        conversationId: await this.conversationIdOf(roomName),
        pressedAt: new Date(miss.pressedAt),
      },
    });
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
function summarize(conversation: {
  readonly roomName: string;
  readonly scenarioId: string;
  readonly speed: number;
  readonly createdAt: Date;
  readonly turns: readonly {
    role: 'agent' | 'user';
    startedAt: Date;
    endedAt: Date | null;
  }[];
  readonly report: { readonly status: string } | null;
}): Record<string, unknown> {
  return {
    roomName: conversation.roomName,
    scenarioId: conversation.scenarioId,
    speed: conversation.speed,
    createdAt: conversation.createdAt.toISOString(),
    durationSeconds: conversationDurationSeconds(conversation.turns),
    reportStatus: conversation.report?.status ?? null,
  };
}
