import { describe, expect, it } from 'vitest';
import { buildReportPrompt } from '../src/reports/report-prompt.js';
import type { ReportInput } from '../src/reports/report-model.js';

const input: ReportInput = {
  transcript: [
    { role: 'agent', text: 'Any blockers on your end?' },
    { role: 'user', text: 'No blocker, I finish the report yesterday.' },
    { role: 'agent', text: "Let's circle back after lunch." },
    { role: 'user', text: 'Okay, see you.' },
  ],
  missedTurnIndexes: [0, 2],
};

describe('buildReportPrompt', () => {
  it('numbers every transcript turn and lists the missed indexes', () => {
    const { user } = buildReportPrompt(input);

    expect(user).toContain('[0] Agent: Any blockers on your end?');
    expect(user).toContain(
      '[1] User: No blocker, I finish the report yesterday.',
    );
    expect(user).toContain("[2] Agent: Let's circle back after lunch.");
    expect(user).toContain('[3] User: Okay, see you.');
    expect(user).toContain('Missed turn indexes: 0, 2');
  });

  it('names no Scenario', () => {
    const { user } = buildReportPrompt(input);

    expect(user).not.toContain('Scenario:');
  });

  it('says there are no missed turns when the list is empty', () => {
    const { user } = buildReportPrompt({ ...input, missedTurnIndexes: [] });

    expect(user).toContain('Missed turn indexes: none');
  });

  it('asks for Vietnamese explanations and at most five grammar issues from User turns', () => {
    const { system } = buildReportPrompt(input);

    expect(system).toContain('Vietnamese office worker');
    expect(system).toContain('spoken English');
    expect(system).toMatch(/idioms, reduced forms, phrasal verbs/);
    expect(system).toContain('acronyms');
    expect(system).toContain('keyPhrases');
    expect(system).toMatch(/explanation.*in Vietnamese/s);
    expect(system).toMatch(/at most 5 grammar issues/i);
    expect(system).toMatch(/User turns only/i);
    expect(system).toContain('said');
    expect(system).toContain('corrected');
    expect(system).toMatch(/reason.*in Vietnamese/s);
    expect(system).toMatch(/no praise, no scores/i);
    expect(system).toMatch(/nothing outside the JSON/i);
  });
});
