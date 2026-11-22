import { screen, waitFor, within } from '@testing-library/react';

/**
 * The `role="status"` live region that has a message in it, or `null` when
 * every status region is empty. Every Astryx `Button` renders its own empty
 * `role="status"` region for the loading announcement, so a page with a
 * button has more than one. Like `queryByRole`, it throws when more than one
 * region has a message. Pass `container` to look only inside it, such as one
 * table row.
 */
export function queryStatusMessage(
  container?: HTMLElement,
): HTMLElement | null {
  const queries = container === undefined ? screen : within(container);
  const messages = queries
    .queryAllByRole('status')
    .filter((region) => region.textContent.trim() !== '');
  if (messages.length > 1) {
    throw new Error('More than one status region has a message.');
  }
  return messages[0] ?? null;
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
