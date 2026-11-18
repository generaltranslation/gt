import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig, mergeConfig } from 'vitest/config';
import { vitestPreset } from '../../vitest.preset.mts';
import { gtSvelte } from './src/lib/vite/index.ts';

const runtimeEntry = fileURLToPath(
  new URL('./src/lib/index.ts', import.meta.url)
);

export default mergeConfig(
  vitestPreset,
  defineConfig({
    plugins: [gtSvelte({ manifest: false }), svelte()],
    resolve: {
      alias: [{ find: /^gt-svelte$/, replacement: runtimeEntry }],
    },
    test: {
      env: { _GT_LOG_LEVEL: 'off' },
      projects: [
        {
          extends: true,
          test: {
            name: 'node',
            environment: 'node',
            include: ['src/**/__tests__/**/*.test.ts'],
            exclude: ['src/**/__tests__/**/*.dom.test.ts'],
          },
        },
        {
          extends: true,
          resolve: { conditions: ['browser'] },
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/**/__tests__/**/*.dom.test.ts'],
          },
        },
      ],
    },
  })
);
