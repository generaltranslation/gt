import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../../vitest.preset.mts';

// The example builds are slow, so their test file is only collected when it is
// enabled (`pnpm test:integration`).
const integration = process.env.BUNDLE_ANALYSIS_INTEGRATION === '1';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    test: {
      include: ['__tests__/**/*.test.ts'],
      exclude: [
        ...configDefaults.exclude,
        ...(integration ? [] : ['__tests__/**/*.integration.test.ts']),
      ],
    },
  })
);
