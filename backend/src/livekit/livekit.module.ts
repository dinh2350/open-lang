import { Module } from '@nestjs/common';
import { LIVEKIT_CONFIG, loadLiveKitConfig } from './livekit-config.js';
import { RoomTokenController } from './room-token.controller.js';
import { RoomTokenService } from './room-token.service.js';

@Module({
  controllers: [RoomTokenController],
  providers: [
    RoomTokenService,
    {
      provide: LIVEKIT_CONFIG,
      useFactory: () => loadLiveKitConfig(process.env),
    },
  ],
})
export class LiveKitModule {}
