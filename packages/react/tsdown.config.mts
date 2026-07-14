import { defineConfig } from 'tsdown';
import {
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
  'src/macros.ts',
];

export default defineConfig(
  entries
    .flatMap((entry, index) => {
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
        },
      ];
    })
    .concat({
      entry: ['src/index.types.d.ts'],
      format: ['esm'],
      dts: {
        emitDtsOnly: true,
        sourcemap: false,
      },
      sourcemap: false,
      clean: false,
      outExtensions: () => ({ dts: '.d.ts' }),
    })
);
