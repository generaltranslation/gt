import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 2,
        maxThreads: 4,
      },
    },
    fileParallelism: true,
    sequence: {
      concurrent: true,
    },
    testTimeout: 15000,
    isolate: true,
    environment: 'node',
    globals: true,
    env: {
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
