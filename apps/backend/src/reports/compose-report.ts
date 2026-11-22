import type { ConversationReport, ListeningMiss } from '@open-lang/shared';
import { computeFluency } from './fluency.js';
import type { ReportDraft } from './report-model.js';
import type { TimedTurn } from './resolve-misses.js';

const MAX_GRAMMAR_ISSUES = 5;

/**
 * Builds the Report from the model's draft. The Agent's words come from the
 * transcript, not from the model, and a miss the Member did not press for is dropped.
 */
export function composeReport(
  turns: readonly TimedTurn[],
  missedTurnIndexes: readonly number[],
  draft: ReportDraft,
): ConversationReport {
  const missed = new Set(missedTurnIndexes);
  const listeningMisses: ListeningMiss[] = draft.listeningMisses.flatMap(
    (miss) => {
      const turn = turns.at(miss.turnIndex);
      if (turn === undefined || !missed.has(miss.turnIndex)) return [];
      return [
        {
          agentText: turn.text,
          keyPhrases: [...miss.keyPhrases],
          explanation: miss.explanation,
        },
      ];
    },
  );

  return {
    listeningMisses,
    grammarIssues: draft.grammarIssues.slice(0, MAX_GRAMMAR_ISSUES),
    fluency: computeFluency(turns),
  };
}
