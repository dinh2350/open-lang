import type { ConversationChoice, User } from '@open-lang/shared';
import { Injectable } from '@nestjs/common';
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
}
