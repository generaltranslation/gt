import { defineConfig } from 'tsdown';
import {
  createRemoveRuntimeArtifactsHook,
  createTsdownUnbundleConfig,
  createUseClientBoundaryPlugin,
} from '../../tsdown.preset.mts';

const neverBundle = [
  /^server-only$/,
  /^gt-next\/internal\/_get(Locale|Region)$/,
];

export default defineConfig([
  {
    ...createTsdownUnbundleConfig({
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
    // src/index.types.ts only backs the exports map's "types" condition; its
    // declarations ship, but its runtime modules are unreachable.
    onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
      'index.types.js',
      'index.types.js.map',
    ]),
  },
  {
    ...createTsdownUnbundleConfig({
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
    onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
      'index.types.mjs',
      'index.types.mjs.map',
    ]),
  },
]);
