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

// Output name → source. The experimental entries (locale twins) re-export
// the regular entry of the same runtime and add their twin versions. They
// have no 'use client' directive, so the use-client boundary plugin keeps
// that regular entry external (`../index.client.mjs`) instead of bundling a
// second copy of it.
const namedEntries: Record<string, string> = {
  'index.rsc': 'src/index.rsc.ts',
  'index.client': 'src/index.client.ts',
  'index.server': 'src/index.server.ts',
  'index.types': 'src/index.types.ts',
  macros: 'src/macros.ts',
  'experimental/index.rsc': 'src/experimental/index.rsc.ts',
  'experimental/index.client': 'src/experimental/index.client.ts',
  'experimental/index.server': 'src/experimental/index.server.ts',
  'experimental/index.types': 'src/experimental/index.types.ts',
};
const entries = Object.values(namedEntries);

// The types entries only back the exports map's "types" conditions; their
// declaration outputs are published but their runtime bundles are
// unreachable, so they are deleted after each build.
const typesOnlyEntries = new Set(['index.types', 'experimental/index.types']);

export default defineConfig(
  withPackageChecks(
    Object.entries(namedEntries).flatMap(([name, entry], index) => {
      const entryDeps = /^(experimental\/)?index\./.test(name)
        ? contextDeps
        : deps;
      const [cjsConfig, esmConfig] = createTsdownConfig(
        { [name]: entry },
        entryDeps
      );

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
          ...(typesOnlyEntries.has(name) && {
            onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
              `${name}.cjs`,
              `${name}.cjs.map`,
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
          ...(typesOnlyEntries.has(name) && {
            onSuccess: createRemoveRuntimeArtifactsHook(process.cwd(), 'dist', [
              `${name}.mjs`,
              `${name}.mjs.map`,
            ]),
          }),
        },
      ];
    })
  )
);
