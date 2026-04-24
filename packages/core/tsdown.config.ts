import { defineConfig } from 'tsdown';

const entry = [
  'src/index.ts',
  'src/id.ts',
  'src/internal.ts',
  'src/errors.ts',
  'src/types.ts',
];

export default defineConfig([
  {
    entry,
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    deps: {
      onlyBundle: false,
      alwaysBundle: [/^@noble\/hashes/],
    },
  },
  {
    entry,
    format: ['esm'],
    sourcemap: true,
  },
]);
