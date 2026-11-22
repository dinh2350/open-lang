import { screen, waitFor, within } from '@testing-library/react';

/**
 * The `role="status"` live region that has a message in it, or `null` when
 * every status region is empty. Every Astryx `Button` renders its own empty
 * `role="status"` region for the loading announcement, so a page with a
 * button has more than one. Pass `container` to look only inside it, such
 * as one table row.
 */
export function queryStatusMessage(
  container?: HTMLElement,
): HTMLElement | null {
  const queries = container === undefined ? screen : within(container);
  return (
    queries
      .queryAllByRole('status')
      .find((region) => region.textContent !== '') ?? null
  );
}

/** Like `queryStatusMessage`, but throws when no status region has a message. */
export function getStatusMessage(container?: HTMLElement): HTMLElement {
  const message = queryStatusMessage(container);
  if (message === null) {
    throw new Error('No status region has a message.');
  }
  return message;
}

/** Waits for the `role="status"` live region that has a message in it. */
export async function findStatusMessage(
  container?: HTMLElement,
): Promise<HTMLElement> {
  return waitFor(() => getStatusMessage(container));
}
