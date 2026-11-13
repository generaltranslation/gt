import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestPreset,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    },
  })
);
