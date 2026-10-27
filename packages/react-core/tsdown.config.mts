import { defineConfig, type Rolldown } from 'tsdown';
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

// The import condition gets .d.mts stubs that re-export the CJS-scoped .d.ts
// instead of a second set of declarations. With two sets, a NodeNext ESM
// consumer that reaches react-core both directly and through a dependent's
// CJS-scoped declarations (gt-react-native, gt-next) sees two incompatible
// copies of each class.
const esmDeclarationStubs: Rolldown.Plugin = {
  name: 'gt-react-core:esm-declaration-stubs',
  generateBundle(_options, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk' || !chunk.isEntry) continue;
      const name = chunk.fileName.replace(/\.mjs$/, '');
      if (!entries.includes(`src/${name}.ts`)) continue;
      this.emitFile({
        type: 'asset',
        fileName: `${name}.d.mts`,
        source: `export * from './${name}.js';\n`,
      });
    }
  },
};

const esm = createTsdownUnbundleConfig({
  format: 'esm',
  entry: entries,
  clean: false,
  outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
  plugins: [esmDeclarationStubs],
});

export default defineConfig([
  { ...cjs, minify: true, dts: true },
  { ...esm, minify: true },
]);
