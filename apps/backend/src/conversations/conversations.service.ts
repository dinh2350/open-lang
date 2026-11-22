import type {
  ConversationChoice,
  MissIngest,
  TurnIngest,
  User,
} from '@open-lang/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
