import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { RoomTokenController } from './room-token.controller.js';
import { RoomTokenService } from './room-token.service.js';

@Module({
  imports: [ConversationsModule],
  controllers: [RoomTokenController],
  providers: [RoomTokenService],
})
export class LiveKitModule {}
