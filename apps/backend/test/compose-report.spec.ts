import { describe, expect, it } from 'vitest';
import { composeReport } from '../src/reports/compose-report.js';
import {
  parseReportDraft,
  ReportModelError,
  type ReportDraft,
} from '../src/reports/report-model.js';
import type { TimedTurn } from '../src/reports/resolve-misses.js';

const at = (seconds: number): Date =>
  new Date(Date.UTC(2026, 10, 23, 10, 0, seconds));

const turns: TimedTurn[] = [
  {
    role: 'agent',
    text: 'Any blockers today?',
    startedAt: at(0),
    endedAt: at(3),
  },
  {
    role: 'user',
    text: 'I am no blocker.',
    startedAt: at(3),
    endedAt: at(6),
  },
  {
    role: 'agent',
    text: 'Great, thanks.',
    startedAt: at(6),
    endedAt: at(8),
  },
];

const issue = (n: number) => ({
  said: `said ${String(n)}`,
  corrected: `corrected ${String(n)}`,
  reason: `lý do ${String(n)}`,
});

const emptyDraft: ReportDraft = { listeningMisses: [], grammarIssues: [] };

describe('composeReport', () => {
  it('keeps at most five grammar issues', () => {
    const draft: ReportDraft = {
      listeningMisses: [],
      grammarIssues: [1, 2, 3, 4, 5, 6, 7].map(issue),
    };

    const report = composeReport(turns, [], draft);

    expect(report.grammarIssues).toEqual([1, 2, 3, 4, 5].map(issue));
  });

  it("takes the Agent's own words from the transcript", () => {
    const draft: ReportDraft = {
      listeningMisses: [
        {
          turnIndex: 0,
          keyPhrases: ['blockers'],
          explanation: 'Có vướng mắc không?',
        },
      ],
      grammarIssues: [],
    };

    const report = composeReport(turns, [0], draft);

    expect(report.listeningMisses).toEqual([
      {
        agentText: 'Any blockers today?',
        keyPhrases: ['blockers'],
        explanation: 'Có vướng mắc không?',
      },
    ]);
  });

  it('drops a listening miss that names a turn that was not missed', () => {
    const draft: ReportDraft = {
      listeningMisses: [
        { turnIndex: 0, keyPhrases: [], explanation: 'a' },
        { turnIndex: 2, keyPhrases: [], explanation: 'b' },
        { turnIndex: 9, keyPhrases: [], explanation: 'c' },
      ],
      grammarIssues: [],
    };

    const report = composeReport(turns, [2, 9], draft);

    expect(report.listeningMisses.map((miss) => miss.explanation)).toEqual([
      'b',
    ]);
  });

  it('returns empty lists for an empty draft', () => {
    const report = composeReport([], [], emptyDraft);

    expect(report.listeningMisses).toEqual([]);
    expect(report.grammarIssues).toEqual([]);
    expect(report.fluency).toEqual({
      wordsPerMinute: null,
      talkRatio: null,
      fillerWordsEstimate: 0,
      longestTurnSeconds: null,
    });
  });

  it('does not change its inputs', () => {
    const draft: ReportDraft = {
      listeningMisses: [],
      grammarIssues: [1, 2, 3, 4, 5, 6].map(issue),
    };

    composeReport(turns, [], draft);

    expect(draft.grammarIssues).toHaveLength(6);
  });
});

describe('parseReportDraft', () => {
  const draftJson = JSON.stringify({
    listeningMisses: [{ turnIndex: 0, keyPhrases: ['a'], explanation: 'b' }],
    grammarIssues: [issue(1)],
  });

  it('accepts the draft JSON, also inside a json code fence', () => {
    const expected = {
      listeningMisses: [{ turnIndex: 0, keyPhrases: ['a'], explanation: 'b' }],
      grammarIssues: [issue(1)],
    };

    expect(parseReportDraft(draftJson)).toEqual(expected);
    expect(parseReportDraft('```json\n' + draftJson + '\n```')).toEqual(
      expected,
    );
  });

  it('throws ReportModelError on text that is not JSON', () => {
    expect(() => parseReportDraft('Sorry, I cannot do that.')).toThrow(
      ReportModelError,
    );
  });

  it('throws ReportModelError when an issue has no corrected sentence', () => {
    const text = JSON.stringify({
      listeningMisses: [],
      grammarIssues: [{ said: 'x', reason: 'y' }],
    });

    expect(() => parseReportDraft(text)).toThrow(ReportModelError);
  });
});
