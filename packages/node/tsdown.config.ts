import { defineConfig } from 'tsdown';

const entry = ['src/index.ts', 'src/types.ts', 'src/internal.ts'];

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
