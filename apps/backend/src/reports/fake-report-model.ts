import type { ReportDraft, ReportInput, ReportModel } from './report-model.js';

/** A canned ReportModel for tests and for running without a real model. */
export class FakeReportModel implements ReportModel {
  draft(input: ReportInput): Promise<ReportDraft> {
    return Promise.resolve({
      listeningMisses: input.missedTurnIndexes.map((turnIndex) => ({
        turnIndex,
        keyPhrases: [],
        explanation: 'Giải thích thử nghiệm.',
      })),
      grammarIssues: input.transcript
        .filter((turn) => turn.role === 'user')
        .map((turn) => ({
          said: turn.text,
          corrected: `${turn.text} (đã sửa)`,
          reason: 'Lý do thử nghiệm.',
        })),
    });
  }
}
