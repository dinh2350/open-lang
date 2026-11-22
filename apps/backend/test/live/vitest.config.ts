import { defineProject } from 'vitest/config';

/**
 * The live tier, run by `pnpm test:live`: the report models against real
 * Providers. It is not one of the root `pnpm test` projects, and needs no
 * database.
 */
export default defineProject({
  test: {
    name: 'backend-live',
    root: import.meta.dirname,
    include: ['**/*.spec.ts'],
    testTimeout: 90_000,
  },
});
