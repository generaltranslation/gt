import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { gtPreprocess } from './src/preprocess';

const alias = {
  'gt-svelte': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
};

const plugins = [svelte({ preprocess: [gtPreprocess()] })];

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        resolve: { alias },
        test: {
          name: 'server',
          environment: 'node',
          include: [
            '__tests__/**/*.server.test.ts',
            '__tests__/**/*.unit.test.ts',
          ],
          env: { _GT_LOG_LEVEL: 'off' },
        },
      },
      {
        plugins,
        resolve: { alias, conditions: ['browser'] },
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['__tests__/**/*.client.test.svelte.ts'],
          // createServerRenderer() starts and compiles a Vite SSR server in
          // beforeAll, which takes about 7s in CI and can exceed the 10s default.
          hookTimeout: 60_000,
          env: { _GT_LOG_LEVEL: 'off' },
        },
      },
    ],
  },
});
