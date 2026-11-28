import type { LearnerBrief } from '@open-lang/shared';

/**
 * What would end a line, or act as a control, in a field the model reads:
 * every control character (newline, tab, escape...) and the Unicode line and
 * paragraph separators.
 */
const BREAKS_A_LINE = /[\p{Cc}\p{Zl}\p{Zp}]/gu;

/** A field on one line: each newline or control character becomes a space. */
function oneLine(field: string): string {
  return field.replace(BREAKS_A_LINE, ' ');
}

/**
 * The lines that tell the tutor what the User has already studied, from the
 * learner brief the job came with. They are the end of the tutor's
 * instructions, so they are in English, one idea per sentence, one sentence
 * per line, and each item stays on one line: the text of an item is data
 * from the User's Notes, and must not become a line of instructions. There
 * are none without a brief or without items, so the tutor is then exactly as
 * it is without a brief.
 */
export function learnerBriefInstructions(brief: LearnerBrief | null): string[] {
  if (brief === null || brief.items.length === 0) return [];
  return [
    'The User has already studied the items below.',
    'Do not read this list aloud.',
    ...brief.items.map(
      ({ english, meaning, status }) =>
        `- [${status}] ${oneLine(english)} = ${oneLine(meaning)}`,
    ),
    'Do not teach a mastered item as new.',
    'When the User brings up a mastered item, confirm it briefly and move on.',
    'You may review a learning item briefly when it fits.',
    'Never teach a learning item from scratch.',
    'Prefer teaching something the User has not studied yet.',
    'Do not save a note for an item in the list unless you taught it again.',
  ];
}
