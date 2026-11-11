import { defineConfig } from 'vitest/config';

// The example builds are slow, so their test file is only collected when it is
// enabled (`pnpm test:integration`).
const integration = process.env.BUNDLE_ANALYSIS_INTEGRATION === '1';

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    exclude: integration ? [] : ['__tests__/**/*.integration.test.ts'],
    // Worker threads start faster than the default child-process pool.
    pool: 'threads',
    // Start workers as files need them instead of one per CPU core up front.
    minWorkers: 1,
  },
});
