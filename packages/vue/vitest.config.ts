import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestPreset,
  defineConfig({
    test: {
      environment: 'node',
      globals: true,
      // Vue prints this notice once per process on the first client Suspense.
      onConsoleLog: (log) =>
        !log.includes('<Suspense> is an experimental feature'),
    },
  })
);
