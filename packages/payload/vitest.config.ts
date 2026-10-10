import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Each test file starts its own Payload, which is CPU heavy, so files run
    // one at a time to leave CI's cores to the other packages' tests that
    // run alongside, some of which have tight timeouts.
    maxWorkers: 1,
  },
});
