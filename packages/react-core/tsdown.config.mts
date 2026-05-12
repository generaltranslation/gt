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

const entryNames = ['index', 'internal', 'errors', 'types'];

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

export default defineConfig(
  entryNames.flatMap((entryName, index) => [
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
  ])
);
