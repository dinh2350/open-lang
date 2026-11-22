import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AgentIngestController } from './agent-ingest.controller.js';
import { ConversationsService } from './conversations.service.js';

/** The Conversation records: each Room Token creates one, and the Agent reports into it. */
@Module({
  imports: [PrismaModule],
  controllers: [AgentIngestController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
