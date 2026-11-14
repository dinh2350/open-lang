import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'backend',
    include: ['test/**/*.spec.ts'],
    // A real Postgres from Testcontainers: needs Docker.
    globalSetup: ['test/database/global-setup.ts'],
    setupFiles: ['test/database/setup.ts'],
  },
});
