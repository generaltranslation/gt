import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        // Use more workers for better parallelization
        minThreads: 2,
        maxThreads: 4,
      },
    },
    // Run tests in parallel (default is true, but being explicit)
    fileParallelism: true,
    // Enable concurrent test execution within files
    sequence: {
      concurrent: true,
    },
    // Set reasonable timeout for all tests
    testTimeout: 15000,
    // Faster test discovery
    isolate: false,
    // Environment setup
    environment: 'node',
    // Globals for easier test writing
    globals: true,
    // Better reporting
    reporters: [
      [
        'default',
        {
          summary: true,
        },
      ],
    ],
  },
});
