import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { LiveKitModule } from './livekit/livekit.module.js';

@Module({
  imports: [HealthModule, LiveKitModule],
})
export class AppModule {}
