import { defineConfig } from 'tsdown';

const entry = [
  'src/index.ts',
  'src/internal.ts',
  'src/client.ts',
  'src/browser.ts',
  'src/browser-types.ts',
  'src/macros.ts',
];

export default defineConfig([
  {
    entry,
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    deps: { onlyBundle: false },
  },
  {
    entry,
    format: ['esm'],
    sourcemap: true,
  },
]);
