import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // RuleTester registers its cases through the global describe/it/afterAll.
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // The suites are pure RuleTester tables (no mocks, no global state), so
    // every file runs in one worker and shares one module registry: ESLint
    // and the TypeScript parser are imported once instead of once per file.
    isolate: false,
    fileParallelism: false,
  },
});
