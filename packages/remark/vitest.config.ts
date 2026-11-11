import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Worker threads start faster than the default child-process pool.
    pool: 'threads',
    // Start workers as files need them instead of one per CPU core up front.
    minWorkers: 1,
  },
});
