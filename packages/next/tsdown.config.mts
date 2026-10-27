import { defineConfig, type Rolldown } from 'tsdown';
import {
  createRemoveRuntimeArtifactsHook,
  createTsdownUnbundleConfig,
  createUseClientBoundaryPlugin,
} from '../../tsdown.preset.mts';

const neverBundle = [
  /^server-only$/,
  /^gt-next\/internal\/_get(Locale|Region)$/,
];

// The import condition of each typed export gets a .d.mts stub that re-exports
// the CJS-scoped .d.ts instead of a second set of declarations (same as
// @generaltranslation/react-core): node16 ESM consumers get ESM-scoped entry
// types and one declaration graph.
const esmDeclarationStubs: Record<string, string> = {
  'index.types': "export * from './index.types.js';\n",
  'index.rsc': "export * from './index.rsc.js';\n",
  config: "export * from './config.js';\n",
  server: "export * from './server.js';\n",
  middleware: "export * from './middleware.js';\n",
  // `export *` skips default, and re-exporting the CJS module's default would
  // type it as the CJS namespace, so re-export the Link binding itself.
  link: "export * from './link.js';\nexport { Link as default } from './link/Link.js';\n",
  'internal/_dictionary': "export * from './_dictionary.js';\n",
  'internal/_load-translations': "export * from './_load-translations.js';\n",
  'internal/_load-dictionary': "export * from './_load-dictionary.js';\n",
  'internal/_getLocale': "export * from './_getLocale.js';\n",
  'internal/_getRegion': "export * from './_getRegion.js';\n",
};

const esmDeclarationStubsPlugin: Rolldown.Plugin = {
  name: 'gt-next:esm-declaration-stubs',
  generateBundle() {
    for (const [name, source] of Object.entries(esmDeclarationStubs)) {
      this.emitFile({ type: 'asset', fileName: `${name}.d.mts`, source });
    }
  },
};

export default defineConfig([
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
        esmDeclarationStubsPlugin,
      ],
    }),
    onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
      'index.types.mjs',
      'index.types.mjs.map',
    ]),
  },
]);
