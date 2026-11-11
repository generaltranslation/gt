import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from './vitest.preset.mts';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    test: {
      globals: true,
      environment: 'node',
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
  })
);
