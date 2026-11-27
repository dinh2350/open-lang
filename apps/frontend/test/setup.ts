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

// jsdom has no canvas: its `getContext` prints "Not implemented" and returns
// null. Every test gets the null without the noise, as a browser without
// WebGL would answer; a test that needs a context stubs `getContext` itself.
// This is a plain assignment, not a `vi` spy, so no reset of mocks undoes it.
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  await allRequestsAnswered();
  resetBackend();
});
