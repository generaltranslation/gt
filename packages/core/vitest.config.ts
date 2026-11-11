import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Worker threads start faster than the default child-process pool.
    pool: 'threads',
    // Headroom over the 5s default for a CI runner shared with every package.
    testTimeout: 15000,
    // Keep the GT logger quiet in test output.
    env: {
      _GT_LOG_LEVEL: 'off',
    },
  },
});
