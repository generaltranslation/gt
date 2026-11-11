import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Importing Payload and starting an instance takes a second or two here
    // and many times that on a busy CI runner.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
