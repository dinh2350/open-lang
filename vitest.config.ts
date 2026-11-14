import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['*/vitest.config.ts'],
    coverage: {
      provider: 'v8',
      include: ['*/src/**/*.{ts,tsx}'],
      reporter: ['text-summary', 'lcov'],
    },
  },
});
