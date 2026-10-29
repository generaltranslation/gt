import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'gt-tanstack-start/internal/_config': fileURLToPath(
        new URL('./src/internal/_config.ts', import.meta.url)
      ),
      'gt-tanstack-start/internal/localeRouting': fileURLToPath(
        new URL('./src/internal/localeRouting.ts', import.meta.url)
      ),
    },
    // gt-react and react-core (workspace links) install their own React copy;
    // render tests need one React, the copy react-dom uses here.
    dedupe: ['react', 'react-dom'],
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
