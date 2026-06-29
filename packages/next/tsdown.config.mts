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
    // Server-only modules use require() for lazy loading. Don't emit rolldown's
    // `createRequire`-from-`node:module` shim: it's statically reachable from
    // client init code and breaks client bundlers (Turbopack "node:module"
    // external; webpack UnhandledSchemeError). Next provides `require` for the
    // guarded, server-only call sites in every bundling context that runs them.
    outputOptions: { polyfillRequire: false },
    plugins: [
      createUseClientBoundaryPlugin({
        name: 'gt-next:use-client-boundaries',
        outputExtension: '.mjs',
      }),
    ],
  }),
]);
