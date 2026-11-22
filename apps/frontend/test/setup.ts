import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';
import { allRequestsAnswered, backend, resetBackend } from './backend';

// The backend stays up until the test process exits, without `close()`:
// when a Conversation ends or the page unmounts, useSession fetches the next
// Room Token in the background, and that request can outlive the last test.
beforeAll(() => {
  backend.listen({ onUnhandledFrame: 'error' });
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  await allRequestsAnswered();
  resetBackend();
});
