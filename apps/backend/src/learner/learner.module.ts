import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../config/env.schema.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { createLearnerModel } from './create-learner-model.js';
import { LEARNER_MODEL, type LearnerModel } from './learner-model.js';
import { LearnerService } from './learner.service.js';

/** Keeps the learner profile, judged by the model `LEARNER_PROVIDER` names. */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: LEARNER_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<BackendEnv, true>): LearnerModel =>
        createLearnerModel({
          LEARNER_PROVIDER: config.getOrThrow('LEARNER_PROVIDER', {
            infer: true,
          }),
          LEARNER_MODEL: config.get('LEARNER_MODEL', { infer: true }),
          OPENAI_API_KEY: config.get('OPENAI_API_KEY', { infer: true }),
          GOOGLE_API_KEY: config.get('GOOGLE_API_KEY', { infer: true }),
        }),
    },
    LearnerService,
  ],
  exports: [LearnerService],
})
export class LearnerModule {}
