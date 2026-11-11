import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Worker threads start faster than forked processes; files stay isolated.
    pool: 'threads',
    testTimeout: 15000,
  },
});
