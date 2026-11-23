import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../config/env.schema.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { createReportModel } from './create-report-model.js';
import { REPORT_END_WAIT } from './end-wait.js';
import { REPORT_MODEL, type ReportModel } from './report-model.js';
import { defaultEndWait, ReportService } from './report.service.js';

/** Writes the Reports of Conversations with the model `REPORT_PROVIDER` names. */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: REPORT_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<BackendEnv, true>): ReportModel =>
        createReportModel({
          REPORT_PROVIDER: config.getOrThrow('REPORT_PROVIDER', {
            infer: true,
          }),
          REPORT_MODEL: config.get('REPORT_MODEL', { infer: true }),
          OPENAI_API_KEY: config.get('OPENAI_API_KEY', { infer: true }),
          GOOGLE_API_KEY: config.get('GOOGLE_API_KEY', { infer: true }),
        }),
    },
    { provide: REPORT_END_WAIT, useValue: defaultEndWait },
    ReportService,
  ],
  exports: [ReportService],
})
export class ReportsModule {}
