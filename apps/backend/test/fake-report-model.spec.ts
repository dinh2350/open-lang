import { describe, expect, it } from 'vitest';
import { FakeReportModel } from '../src/reports/fake-report-model.js';
import type { ReportModel } from '../src/reports/report-model.js';

describe('FakeReportModel', () => {
  it('FakeReportModel returns a short canned assessment', async () => {
    const model: ReportModel = new FakeReportModel();

    const draft = await model.draft({
      transcript: [
        { role: 'agent', text: 'Any blockers?' },
        { role: 'user', text: 'No blocker.' },
      ],
      notes: [],
    });

    expect(draft).toEqual({
      assessment: {
        overview: 'Nhận xét thử nghiệm.',
        strengths: ['Điểm mạnh thử nghiệm.'],
        improvements: ['Điểm cần cải thiện thử nghiệm.'],
      },
    });
  });
});
