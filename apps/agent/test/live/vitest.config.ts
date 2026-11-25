import { defineProject } from 'vitest/config';

/**
 * The live tier, run by `pnpm test:live`: Agent tests against real
 * Providers. It is not one of the root `pnpm test` projects.
 */
export default defineProject({
  test: {
    name: 'agent-live',
    root: import.meta.dirname,
    include: ['**/*.spec.ts'],
    // A check may take several turns, each of them spoken by a real model.
    testTimeout: 120_000,
  },
});
