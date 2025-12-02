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
    // Proper test isolation to prevent mock interference
    isolate: true,
    // Environment setup
    environment: 'node',
    // Globals for easier test writing
    globals: true,
    // Environment variables
    env: {
      // Suppress GT logger output during tests for cleaner output
      _GT_LOG_LEVEL: 'off',
    },
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