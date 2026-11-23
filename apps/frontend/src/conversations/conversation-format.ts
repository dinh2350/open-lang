import { SCENARIOS, type ScenarioId } from '@open-lang/shared';

/** Shown where a number is missing. */
export const NO_VALUE = '—';

// The date is shown in the browser's time zone.
const dateFormat = new Intl.DateTimeFormat('vi', { dateStyle: 'medium' });

/** A Conversation's date, such as "23 thg 11, 2026". */
export function formatDate(isoDateTime: string): string {
  return dateFormat.format(new Date(isoDateTime));
}

/** A Conversation's length in whole minutes, or a dash when it is not known. */
export function formatDuration(durationSeconds: number | null): string {
  if (durationSeconds === null) {
    return NO_VALUE;
  }
  const minutes = Math.round(durationSeconds / 60);
  return minutes < 1 ? 'Dưới 1 phút' : `${String(minutes)} phút`;
}

/** The Vietnamese title of a Scenario. */
export function scenarioTitle(scenarioId: ScenarioId): string {
  return SCENARIOS.find(({ id }) => id === scenarioId)?.title ?? scenarioId;
}
