import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BackendEnv } from '../config/env.schema.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { FakeReportModel } from './fake-report-model.js';
import { REPORT_MODEL, type ReportModel } from './report-model.js';
import { ReportService } from './report.service.js';

/** How to make the ReportModel of each `REPORT_PROVIDER`. */
const MODEL_FACTORIES: Record<
  BackendEnv['REPORT_PROVIDER'],
  () => ReportModel
> = {
  fake: () => new FakeReportModel(),
};

/** Writes the Reports of Conversations with the model `REPORT_PROVIDER` names. */
@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: REPORT_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<BackendEnv, true>): ReportModel =>
        MODEL_FACTORIES[
          config.getOrThrow('REPORT_PROVIDER', { infer: true })
        ](),
    },
    ReportService,
  ],
  exports: [ReportService],
})
export class ReportsModule {}
