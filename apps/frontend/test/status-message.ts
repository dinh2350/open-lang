import { screen, waitFor } from '@testing-library/react';

/**
 * The `role="status"` live region that has a message in it, or `null` when
 * every status region is empty. Every Astryx `Button` renders its own empty
 * `role="status"` region for the loading announcement, so a page with a
 * button has more than one.
 */
export function queryStatusMessage(): HTMLElement | null {
  return (
    screen
      .queryAllByRole('status')
      .find((region) => region.textContent !== '') ?? null
  );
}

/** Like `queryStatusMessage`, but throws when no status region has a message. */
export function getStatusMessage(): HTMLElement {
  const message = queryStatusMessage();
  if (message === null) {
    throw new Error('No status region has a message.');
  }
  return message;
}

/** Waits for the `role="status"` live region that has a message in it. */
export async function findStatusMessage(): Promise<HTMLElement> {
  return waitFor(getStatusMessage);
}
