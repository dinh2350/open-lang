import { ASSESSMENT_LIMITS, conversationReportSchema } from '@open-lang/shared';
import { describe, expect, it } from 'vitest';
import { composeReport } from '../src/reports/compose-report.js';
import {
  parseReportDraft,
  ReportModelError,
  type ReportDraft,
} from '../src/reports/report-model.js';
import type { TimedTurn } from '../src/reports/turn-times.js';

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
];

/** Half of a character outside the Basic Multilingual Plane, without its other half. */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const shortDraft: ReportDraft = {
  assessment: {
    overview: 'Bạn trả lời rõ ràng.',
    strengths: ['Trả lời nhanh.'],
    improvements: ['Dùng thì quá khứ.'],
  },
};

const emptyDraft: ReportDraft = {
  assessment: { overview: '', strengths: [], improvements: [] },
};

describe('composeReport', () => {
  it('keeps a short draft as it is and computes the fluency', () => {
    const report = composeReport(turns, shortDraft);

    expect(report.assessment).toEqual(shortDraft.assessment);
    expect(report.fluency.longestTurnSeconds).toBe(3);
  });

  it('composeReport clamps an over-long draft', () => {
    const draft: ReportDraft = {
      assessment: {
        overview: 'x'.repeat(170),
        strengths: ['s1', 's2', 's3'],
        improvements: ['i1', 'i2', 'i3', 'y'.repeat(120)],
      },
    };

    const report = composeReport(turns, draft);

    const { overview, strengths, improvements } = report.assessment;
    expect(overview.length).toBeLessThanOrEqual(
      ASSESSMENT_LIMITS.overviewLength,
    );
    expect(overview.endsWith('…')).toBe(true);
    expect(strengths).toEqual(['s1', 's2']);
    expect(improvements).toEqual(['i1', 'i2', 'i3']);
    // The Report is still a valid, ready Report.
    expect(conversationReportSchema.safeParse(report).success).toBe(true);
  });

  it('cuts an over-long item to its length, ellipsis included', () => {
    const draft: ReportDraft = {
      assessment: {
        overview: 'ok',
        strengths: ['z'.repeat(ASSESSMENT_LIMITS.itemLength + 1)],
        improvements: ['w'.repeat(ASSESSMENT_LIMITS.itemLength)],
      },
    };

    const { assessment } = composeReport(turns, draft);

    expect(assessment.strengths[0]).toBe(
      `${'z'.repeat(ASSESSMENT_LIMITS.itemLength - 1)}…`,
    );
    expect(assessment.improvements[0]).toBe(
      'w'.repeat(ASSESSMENT_LIMITS.itemLength),
    );
  });

  it('never cuts an overview or an item in the middle of a character', () => {
    const { overviewLength, itemLength } = ASSESSMENT_LIMITS;
    // The emoji's two UTF-16 units sit on either side of the cut.
    const draft: ReportDraft = {
      assessment: {
        overview: `${'x'.repeat(overviewLength - 2)}😀${'x'.repeat(20)}`,
        strengths: [`${'s'.repeat(itemLength - 2)}😀${'s'.repeat(20)}`],
        improvements: [],
      },
    };

    const { assessment } = composeReport(turns, draft);

    const overview = assessment.overview;
    const [strength = ''] = assessment.strengths;
    for (const [clamped, limit] of [
      [overview, overviewLength],
      [strength, itemLength],
    ] as const) {
      expect(clamped).not.toMatch(LONE_SURROGATE);
      expect(clamped.endsWith('…')).toBe(true);
      expect(clamped.length).toBeLessThanOrEqual(limit);
    }
  });

  it('returns an empty assessment for an empty draft', () => {
    const report = composeReport([], emptyDraft);

    expect(report).toEqual({
      assessment: { overview: '', strengths: [], improvements: [] },
      fluency: {
        wordsPerMinute: null,
        talkRatio: null,
        fillerWordsEstimate: 0,
        longestTurnSeconds: null,
      },
    });
  });

  it('does not change its inputs', () => {
    const draft: ReportDraft = {
      assessment: {
        overview: 'x'.repeat(200),
        strengths: ['a', 'b', 'c'],
        improvements: [],
      },
    };

    composeReport(turns, draft);

    expect(draft.assessment.overview).toHaveLength(200);
    expect(draft.assessment.strengths).toHaveLength(3);
  });
});

describe('parseReportDraft', () => {
  const assessment = {
    overview: 'Bạn nói khá trôi chảy.',
    strengths: ['Trả lời đúng ý.'],
    improvements: ['Dùng thì quá khứ.', 'Nói chậm hơn.'],
  };

  it('parseReportDraft reads the new shape and rejects the old one', () => {
    const json = JSON.stringify(assessment);

    expect(parseReportDraft(json)).toEqual({ assessment });
    expect(parseReportDraft('```json\n' + json + '\n```')).toEqual({
      assessment,
    });
    expect(() =>
      parseReportDraft(
        JSON.stringify({ listeningMisses: [], grammarIssues: [] }),
      ),
    ).toThrow(ReportModelError);
  });

  it('accepts a draft over the limits, which composeReport then clamps', () => {
    const long = {
      overview: 'x'.repeat(400),
      strengths: ['a', 'b', 'c', 'd'],
      improvements: ['e', 'f', 'g', 'h', 'i'],
    };

    expect(parseReportDraft(JSON.stringify(long))).toEqual({
      assessment: long,
    });
  });

  it('throws ReportModelError on text that is not JSON', () => {
    expect(() => parseReportDraft('Sorry, I cannot do that.')).toThrow(
      ReportModelError,
    );
  });

  it('throws ReportModelError when a list holds something that is not text', () => {
    const text = JSON.stringify({ ...assessment, strengths: [42] });

    expect(() => parseReportDraft(text)).toThrow(ReportModelError);
  });
});
