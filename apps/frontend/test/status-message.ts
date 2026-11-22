import { screen, waitFor } from '@testing-library/react';

/**
 * Waits for the `role="status"` live region that has a message in it.
 * Every Astryx `Button` renders its own empty `role="status"` region for the
 * loading announcement, so a page with a button has more than one.
 */
export async function findStatusMessage(): Promise<HTMLElement> {
  return waitFor(() => {
    const message = screen
      .getAllByRole('status')
      .find((region) => region.textContent !== '');
    if (message === undefined) {
      throw new Error('No status region has a message yet.');
    }
    return message;
  });
}
