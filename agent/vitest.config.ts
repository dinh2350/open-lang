import { configDefaults, defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'agent',
    include: ['test/**/*.spec.ts'],
    // The live tier needs Provider API keys; `pnpm test:live` runs it.
    exclude: [...configDefaults.exclude, 'test/live/**'],
  },
});
