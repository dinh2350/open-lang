import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { LearnerModule } from '../learner/learner.module.js';
import { RoomTokenController } from './room-token.controller.js';
import { RoomTokenService } from './room-token.service.js';

@Module({
  imports: [ConversationsModule, LearnerModule],
  controllers: [RoomTokenController],
  providers: [RoomTokenService],
})
export class LiveKitModule {}
