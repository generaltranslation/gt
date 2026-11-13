import type { ViteUserConfig } from 'vitest/config';

/**
 * Test settings every package shares. A package's `vitest.config.ts` merges
 * its own settings over one of these presets with `mergeConfig`.
 */
export const vitestPreset = {
  test: {
    // Headroom over the 5s default. CI runs every package's suite at once on
    // a small runner, where a test can take 30 times as long as it does
    // locally.
    testTimeout: 15_000,
  },
} satisfies ViteUserConfig;

/**
 * `vitestPreset` on worker threads, for suites that need nothing a thread
 * lacks (`process.chdir`, native addons that load once per process).
 */
export const vitestThreadsPreset = {
  test: {
    ...vitestPreset.test,
    // Worker threads start faster than the default child-process pool.
    pool: 'threads',
    // Start workers as files need them instead of one per CPU core up front.
    minWorkers: 1,
  },
} satisfies ViteUserConfig;
