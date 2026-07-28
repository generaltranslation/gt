import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { rspack as gtCompiler } from '@generaltranslation/compiler';

const appDir = path.dirname(fileURLToPath(import.meta.url));

// Linked workspace packages (gt-react) must share the app's React instance.
// Only needed inside the GT monorepo; safe to remove in a standalone copy.
const reactDir = fs.realpathSync(path.join(appDir, 'node_modules/react'));
const reactDomDir = fs.realpathSync(
  path.join(appDir, 'node_modules/react-dom')
);

const gtConfig = JSON.parse(
  fs.readFileSync(path.join(appDir, 'gt.config.json'), 'utf8')
);

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    entry: {
      index: './src/index.ts',
    },
  },
  html: {
    title: 'gt-react + Rsbuild',
  },
  resolve: {
    alias: {
      react: reactDir,
      'react-dom': reactDomDir,
    },
  },
  tools: {
    // Run the GT compiler through Rspack. `@generaltranslation/compiler`
    // exposes an `rspack` adapter built on the same unplugin instance as the
    // webpack, vite, and rollup adapters, so Rsbuild wiring is a one-liner.
    rspack: {
      plugins: [gtCompiler(gtConfig)],
    },
  },
});
