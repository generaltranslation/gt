import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Each test file starts its own Payload, so two at a time leave room for
    // the other packages' tests running alongside in CI.
    maxWorkers: 2,
  },
});
