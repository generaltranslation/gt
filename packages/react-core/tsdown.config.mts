import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

const entries = [
  'src/pure.ts',
  'src/hooks.ts',
  'src/components.ts',
  'src/components-rsc.ts',
];

const cjs = createTsdownUnbundleConfig({
  format: 'cjs',
  entry: entries,
  outExtensions: () => ({ js: '.cjs', dts: '.d.ts' }),
});

const esm = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
});

export default defineConfig([
  { ...cjs, minify: true, dts: true },
  { ...esm, minify: true },
]);
