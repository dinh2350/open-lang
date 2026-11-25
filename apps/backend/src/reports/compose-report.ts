import { ASSESSMENT_LIMITS, type ConversationReport } from '@open-lang/shared';
import { computeFluency } from './fluency.js';
import type { ReportDraft } from './report-model.js';
import type { TimedTurn } from './resolve-misses.js';

const ELLIPSIS = '…';

/** `text` cut to at most `maxLength` characters, ending in `…` when it was cut. */
function clamp(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}

/** The first `count` items, each cut to the length of an item. */
function clampItems(items: readonly string[], count: number): string[] {
  return items
    .slice(0, count)
    .map((item) => clamp(item, ASSESSMENT_LIMITS.itemLength));
}

/**
 * Builds the Report from the model's draft. A draft longer than a Report
 * allows is cut to the limits rather than refused, so the Member still gets
 * the Report; the fluency numbers come from the turns, not from the model.
 */
export function composeReport(
  turns: readonly TimedTurn[],
  draft: ReportDraft,
): ConversationReport {
  const { overview, strengths, improvements } = draft.assessment;
  return {
    assessment: {
      overview: clamp(overview, ASSESSMENT_LIMITS.overviewLength),
      strengths: clampItems(strengths, ASSESSMENT_LIMITS.strengths),
      improvements: clampItems(improvements, ASSESSMENT_LIMITS.improvements),
    },
    fluency: computeFluency(turns),
  };
}
