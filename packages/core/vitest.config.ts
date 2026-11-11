import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    test: {
      // Keep the GT logger quiet in test output.
      env: {
        _GT_LOG_LEVEL: 'off',
      },
    },
  })
);
