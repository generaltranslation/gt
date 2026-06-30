import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

const entries = [
  'src/index.ts',
  'src/types.ts',
  'src/fallbacks.ts',
  'src/internal.ts',
  'src/internal-types.ts',
];

const cjs = createTsdownUnbundleConfig({
  format: 'cjs',
  entry: entries,
  outExtensions: () => ({ js: '.cjs', dts: '.d.cts' }),
});

const esm = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  outExtensions: () => ({ js: '.mjs', dts: '.d.mts' }),
});

export default defineConfig([
  { ...cjs, minify: true, dts: true },
  { ...esm, minify: true, dts: true },
]);
