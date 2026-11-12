import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestThreadsPreset } from '../../vitest.preset.mts';

export default mergeConfig(
  vitestThreadsPreset,
  defineConfig({
    resolve: {
      alias: {
        'gt-tanstack-start/internal/_config': fileURLToPath(
          new URL('./src/internal/_config.ts', import.meta.url)
        ),
        'gt-tanstack-start/internal/_compat-config': fileURLToPath(
          new URL('./src/internal/_compat-config.ts', import.meta.url)
        ),
        'gt-tanstack-start/internal/localeRouting': fileURLToPath(
          new URL('./src/internal/localeRouting.ts', import.meta.url)
        ),
      },
    },
  })
);
