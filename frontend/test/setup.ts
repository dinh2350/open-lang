import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';
import { backend, resetBackend } from './backend';

// The backend stays up until the test process exits, without `close()`:
// when a Conversation ends or the page unmounts, useSession fetches the next
// Room Token in the background, and that request can outlive the last test.
beforeAll(() => {
  backend.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  resetBackend();
});
