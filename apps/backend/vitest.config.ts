import { configDefaults, defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'backend',
    include: ['test/**/*.spec.ts'],
    // The live tier needs Provider API keys; `pnpm test:live` runs it.
    exclude: [...configDefaults.exclude, 'test/live/**'],
    // A real Postgres from Testcontainers: needs Docker.
    globalSetup: ['test/database/global-setup.ts'],
    setupFiles: ['test/database/setup.ts'],
  },
});
