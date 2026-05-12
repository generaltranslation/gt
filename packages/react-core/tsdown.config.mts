import { rm } from 'node:fs/promises';

import { defineConfig } from 'tsdown';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^@generaltranslation\/format$/,
    /^@generaltranslation\/supported-locales$/,
    /^generaltranslation$/,
  ],
  alwaysBundle: [
    /^@generaltranslation\/format\//,
    /^generaltranslation\//,
    /^gt-i18n(?:\/.*)?$/,
  ],
  onlyBundle: false,
};

const runtimeEntryNames = ['index', 'internal', 'errors'];
const typeRuntimeArtifacts = [
  'dist/types.cjs.min.cjs',
  'dist/types.cjs.min.cjs.map',
];

const outputOptions = {
  sourcemap: true,
  minify: true,
  deps,
  outExtensions({ format }) {
    return {
      js: format === 'cjs' ? '.cjs.min.cjs' : '.esm.min.mjs',
      dts: '.d.ts',
    };
  },
};

export default defineConfig([
  ...runtimeEntryNames.flatMap((entryName, index) => [
    {
      ...outputOptions,
      entry: [`src/${entryName}.ts`],
      format: ['cjs'],
      dts: true,
      clean: index === 0,
    },
    {
      ...outputOptions,
      entry: [`src/${entryName}.ts`],
      format: ['esm'],
    },
  ]),
  {
    ...outputOptions,
    entry: ['src/types.ts'],
    format: ['cjs'],
    dts: true,
    clean: false,
    onSuccess: async () => {
      await Promise.all(
        typeRuntimeArtifacts.map((artifact) => rm(artifact, { force: true }))
      );
    },
  },
]);
