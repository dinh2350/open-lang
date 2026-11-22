import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConversationsService } from './conversations.service.js';

/** The Conversation records: each Room Token creates one. */
@Module({
  imports: [PrismaModule],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
