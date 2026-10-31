import { defineConfig } from 'tsdown';
import {
  createEsmDeclarationStubsPlugin,
  createTsdownUnbundleConfig,
  withPackageChecks,
} from '../../tsdown.preset.mts';

const entries = [
  'src/pure.ts',
  'src/hooks.ts',
  'src/components.ts',
  'src/components-rsc.ts',
  'src/unstable.ts',
  'src/unstable-rsc.ts',
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
  plugins: [
    createEsmDeclarationStubsPlugin(
      entries.map((entry) => entry.replace(/^src\/|\.ts$/g, ''))
    ),
  ],
});

export default defineConfig(
  withPackageChecks([
    { ...cjs, minify: true, dts: true },
    { ...esm, minify: true },
  ])
);
