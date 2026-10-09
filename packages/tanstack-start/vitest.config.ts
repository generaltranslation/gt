import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'gt-tanstack-start/internal/_config': new URL(
        './src/internal/_config.ts',
        import.meta.url
      ).pathname,
    },
  },
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
