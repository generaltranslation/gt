import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The suite is dominated by importing Babel and the compiler passes, not
    // by test bodies. Each project below runs in one reused worker, so those
    // imports happen once per project instead of once per test file.
    isolate: false,
    poolOptions: { forks: { singleFork: true } },
    projects: [
      {
        extends: true,
        test: {
          // Pure transform tests (source string in, code out). They share a
          // module registry, so they must stay free of vi.mock, global or
          // env stubbing and module-level state; tests that need those
          // belong in the plugin project.
          name: 'transform',
          include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
          exclude: ['src/__tests__/**'],
        },
      },
      {
        extends: true,
        test: {
          // Plugin-level tests stub process.cwd() and console.warn. They run
          // in their own worker with a fresh module registry per file.
          name: 'plugin',
          include: ['src/__tests__/**/*.test.ts'],
          isolate: true,
        },
      },
    ],
  },
});
