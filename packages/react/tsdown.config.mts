import { defineConfig } from 'tsdown';
import {
  createRemoveRuntimeArtifactsHook,
  createTsdownConfig,
  createUseClientBoundaryPlugin,
  withPackageChecks,
} from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [/^react$/, /^react\//, /^react-dom$/, /^react-dom\//],
  alwaysBundle: [
    /^@generaltranslation\/format\//,
    /^@generaltranslation\/react-core\//,
    /^generaltranslation\//,
    /^gt-i18n\//,
  ],
};

const contextDeps = {
  neverBundle: [
    ...deps.neverBundle,
    /^@generaltranslation\/react-core\//,
    /^gt-i18n$/,
    /^gt-i18n\//,
  ],
  alwaysBundle: [/^@generaltranslation\/format\//, /^generaltranslation\//],
};

const entries = [
  'src/index.rsc.ts',
  'src/index.client.ts',
  'src/index.server.ts',
  'src/index.types.ts',
  'src/macros.ts',
  'src/unstable.ts',
  'src/unstable.rsc.ts',
  'src/unstable-icu.ts',
];

// src/index.types.ts only backs the exports map's "types" conditions; its
// declaration outputs are published but its runtime bundles are unreachable,
// so they are deleted after each build.
const typesOnlyEntry = 'src/index.types.ts';

export default defineConfig(
  withPackageChecks(
    entries.flatMap((entry, index) => {
      // unstable entries import gt-i18n and react-core like the index entries,
      // so they share one copy of those packages with the app.
      const entryDeps =
        entry.startsWith('src/index.') || entry.startsWith('src/unstable')
          ? contextDeps
          : deps;
      const [cjsConfig, esmConfig] = createTsdownConfig([entry], entryDeps);

      return [
        {
          ...cjsConfig,
          clean: index === 0,
          define: {
            'import.meta.env': '{}',
          },
          plugins: [
            createUseClientBoundaryPlugin({
              emittedSourceFiles: entries,
              name: 'gt-react:use-client-boundaries',
              outputExtension: '.cjs',
            }),
          ],
          ...(entry === typesOnlyEntry && {
            onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
              'index.types.cjs',
              'index.types.cjs.map',
            ]),
          }),
        },
        {
          ...esmConfig,
          deps: {
            onlyBundle: false,
            ...entryDeps,
          },
          plugins: [
            createUseClientBoundaryPlugin({
              emittedSourceFiles: entries,
              name: 'gt-react:use-client-boundaries',
              outputExtension: '.mjs',
            }),
          ],
          ...(entry === typesOnlyEntry && {
            onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
              'index.types.mjs',
              'index.types.mjs.map',
            ]),
          }),
        },
      ];
    })
  )
);
