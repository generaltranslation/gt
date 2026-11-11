import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Worker threads start faster than the default child-process pool.
    pool: 'threads',
    // Start workers as files need them instead of one per CPU core up front.
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/rollup.config.*',
        '**/tsconfig.json',
      ],
    },
  },
});
