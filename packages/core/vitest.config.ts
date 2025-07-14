import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode || 'test', process.cwd(), '');

  // Get environment variables from either source
  const projectId =
    process.env.VITE_CI_TEST_GT_PROJECT_ID || env.VITE_CI_TEST_GT_PROJECT_ID;
  const apiKey =
    process.env.VITE_CI_TEST_GT_API_KEY || env.VITE_CI_TEST_GT_API_KEY;

  return {
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
      // Setup files to run before tests
      setupFiles: ['./vitest.setup.ts'],
      // Load environment variables from .env files
      // The empty string '' as third parameter loads ALL env vars, not just VITE_ prefixed ones
      env: {
        ...env,
        // Suppress GT logger output during tests for cleaner output
        _GT_LOG_LEVEL: 'off',
        // Pass environment variables directly to test environment
        ...(projectId && { VITE_CI_TEST_GT_PROJECT_ID: projectId }),
        ...(apiKey && { VITE_CI_TEST_GT_API_KEY: apiKey }),
      },
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
  };
});
