import type { ReportDraft, ReportModel } from './report-model.js';

/** A canned ReportModel for tests and for running without a real model. */
export class FakeReportModel implements ReportModel {
  draft(): Promise<ReportDraft> {
    return Promise.resolve({
      assessment: {
        overview: 'Nhận xét thử nghiệm.',
        strengths: ['Điểm mạnh thử nghiệm.'],
        improvements: ['Điểm cần cải thiện thử nghiệm.'],
      },
    });
  }
}
