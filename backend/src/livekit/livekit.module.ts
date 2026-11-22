import { Module } from '@nestjs/common';
import { RoomTokenController } from './room-token.controller.js';
import { RoomTokenService } from './room-token.service.js';

@Module({
  controllers: [RoomTokenController],
  providers: [RoomTokenService],
})
export class LiveKitModule {}
