import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { variants } from './scripts/variants.mjs';

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

const name = process.env.BENCH_VARIANT ?? 'unstable';
const variant = variants[name];
if (!variant) throw new Error(`Unknown BENCH_VARIANT "${name}"`);

export default defineConfig({
  plugins: [variant.compiler?.(), react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@generated',
        replacement: path(`./src/generated/${variant.generated}`),
      },
      { find: '@init', replacement: path(`./src/init/${variant.init}.ts`) },
      ...(variant.release
        ? [{ find: /^gt-react$/, replacement: 'gt-react-release' }]
        : []),
    ],
  },
  build: {
    outDir: process.env.BENCH_OUT_DIR ?? `dist/${name}`,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // An app loads its libraries with its shell, so a route's import
        // loads only the route.
        manualChunks: (id) =>
          /\/(node_modules|packages)\//.test(id) ? 'vendor' : undefined,
      },
    },
  },
});
