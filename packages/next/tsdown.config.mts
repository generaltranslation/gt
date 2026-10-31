import { defineConfig } from 'tsdown';
import {
  createEsmDeclarationStubsPlugin,
  createRemoveRuntimeArtifactsHook,
  createTsdownUnbundleConfig,
  createUseClientBoundaryPlugin,
  withPackageChecks,
} from '../../tsdown.preset.mts';

const neverBundle = [
  /^server-only$/,
  /^gt-next\/internal\/_get(Locale|Region)$/,
];

// The import condition of each typed export gets a .d.mts stub.
const esmDeclarationStubsPlugin = createEsmDeclarationStubsPlugin(
  [
    'index.types',
    'index.rsc',
    'config',
    'server',
    'unstable.types',
    'unstable.rsc',
    'unstable/server',
    'middleware',
    'link',
    'internal/_dictionary',
    'internal/_load-translations',
    'internal/_load-dictionary',
    'internal/_getLocale',
    'internal/_getRegion',
  ],
  {
    // `export *` skips default, and re-exporting the CJS module's default would
    // type it as the CJS namespace, so re-export the Link binding itself.
    link: "export * from './link.js';\nexport { Link as default } from './link/Link.js';\n",
  }
);

export default defineConfig(
  withPackageChecks([
    {
      ...createTsdownUnbundleConfig({
        format: 'cjs',
        cjsDefault: false,
        dts: true,
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
      // src/index.types.ts and src/unstable.types.ts only back the exports map's
      // "types" conditions; their declarations ship, but their runtime modules
      // are unreachable.
      onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
        'index.types.js',
        'index.types.js.map',
        'unstable.types.js',
        'unstable.types.js.map',
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
          esmDeclarationStubsPlugin,
        ],
      }),
      onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
        'index.types.mjs',
        'index.types.mjs.map',
        'unstable.types.mjs',
        'unstable.types.mjs.map',
      ]),
    },
  ])
);
