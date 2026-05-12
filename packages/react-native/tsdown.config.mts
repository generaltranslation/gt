import { defineConfig } from 'tsdown';
import { createTsdownUnbundleConfig } from '../../tsdown.preset.mts';

const entry = ['src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}'];
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
    entry,
    format: 'cjs',
    outDir: 'dist/commonjs',
    dts: false,
    deps,
  }),
  createTsdownUnbundleConfig({
    entry,
    format: 'esm',
    outDir: 'dist/module',
    clean: false,
    deps,
  }),
]);
