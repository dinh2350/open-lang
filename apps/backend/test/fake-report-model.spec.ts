import { describe, expect, it } from 'vitest';
import { FakeReportModel } from '../src/reports/fake-report-model.js';

describe('FakeReportModel', () => {
  it('explains every missed turn and turns every User turn into a grammar issue', async () => {
    const draft = await new FakeReportModel().draft({
      scenarioId: 'daily-standup',
      transcript: [
        { role: 'agent', text: 'Any blockers?' },
        { role: 'user', text: 'No blocker.' },
        { role: 'agent', text: 'Good.' },
        { role: 'user', text: 'Thank you.' },
      ],
      missedTurnIndexes: [0, 2],
    });

    expect(draft.listeningMisses).toEqual([
      { turnIndex: 0, keyPhrases: [], explanation: 'Giải thích thử nghiệm.' },
      { turnIndex: 2, keyPhrases: [], explanation: 'Giải thích thử nghiệm.' },
    ]);
    expect(draft.grammarIssues).toEqual([
      {
        said: 'No blocker.',
        corrected: 'No blocker. (đã sửa)',
        reason: 'Lý do thử nghiệm.',
      },
      {
        said: 'Thank you.',
        corrected: 'Thank you. (đã sửa)',
        reason: 'Lý do thử nghiệm.',
      },
    ]);
  });
});
