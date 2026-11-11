import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
    },
  })
);
