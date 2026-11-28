import { Module } from '@nestjs/common';
import { LearnerModule } from '../learner/learner.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { AgentIngestController } from './agent-ingest.controller.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';

/** The Conversation records: each Room Token creates one, and the Agent reports into it. */
@Module({
  imports: [PrismaModule, ReportsModule, LearnerModule],
  controllers: [AgentIngestController, ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
