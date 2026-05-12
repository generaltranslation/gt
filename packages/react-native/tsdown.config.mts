import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-native$/,
    /^react-native\//,
    /^@generaltranslation\/react-core$/,
    /^@generaltranslation\/format$/,
    /^@generaltranslation\/supported-locales$/,
    /^generaltranslation$/,
  ],
};

export default defineConfig([
  createTsdownUnbundleConfig({
    format: 'cjs',
    outDir: 'dist/commonjs',
    dts: false,
    deps,
    outputOptions: {
      exports: 'named',
    },
  }),
  createTsdownUnbundleConfig({
    format: 'esm',
    outDir: 'dist/module',
    clean: false,
    deps,
  }),
]);
