import { defineConfig } from 'tsdown';
import { createTsdownMinifiedDualFormatConfig } from '../../tsdown.preset.mts';

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
};

const contextDeps = {
  neverBundle: [...deps.neverBundle, /^gt-i18n$/, /^gt-i18n\//],
  alwaysBundle: [/^@generaltranslation\/format\//, /^generaltranslation\//],
};

const bundledEntries = ['src/index.ts', 'src/internal.ts', 'src/errors.ts'];

export default defineConfig([
  ...createTsdownMinifiedDualFormatConfig({
    entries: bundledEntries,
    deps,
  }),
  ...createTsdownMinifiedDualFormatConfig({
    entries: ['src/context.ts'],
    deps: contextDeps,
    clean: false,
    typeEntry: false,
  }),
]);
