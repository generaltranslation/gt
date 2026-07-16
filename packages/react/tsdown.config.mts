import { defineConfig } from 'tsdown';
import {
  createRemoveRuntimeArtifactsHook,
  createTsdownConfig,
  createUseClientBoundaryPlugin,
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
];

// src/index.types.ts only backs the exports map's "types" conditions; its
// declaration outputs are published but its runtime bundles are unreachable,
// so they are deleted after each build.
const typesOnlyEntry = 'src/index.types.ts';

export default defineConfig(
  entries.flatMap((entry, index) => {
    const entryDeps = entry.startsWith('src/index.') ? contextDeps : deps;
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
);
