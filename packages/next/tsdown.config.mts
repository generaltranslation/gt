import { defineConfig } from 'tsdown';
import {
  createTsdownUnbundleConfig,
  createUseClientBoundaryPlugin,
} from '../../tsdown.preset.mts';

const neverBundle = [/^server-only$/];

export default defineConfig([
  createTsdownUnbundleConfig({
    format: 'cjs',
    cjsDefault: false,
    deps: {
      neverBundle,
    },
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    plugins: [
      createUseClientBoundaryPlugin({
        name: 'gt-next:use-client-boundaries',
        outputExtension: '.js',
      }),
    ],
  }),
  createTsdownUnbundleConfig({
    format: 'esm',
    clean: false,
    deps: {
      neverBundle,
    },
    outExtensions: () => ({ js: '.mjs', dts: '.d.ts' }),
    plugins: [
      createUseClientBoundaryPlugin({
        name: 'gt-next:use-client-boundaries',
        outputExtension: '.mjs',
      }),
    ],
  }),
]);
