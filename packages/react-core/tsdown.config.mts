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

export default defineConfig(
  createTsdownMinifiedDualFormatConfig({
    entries: [
      'src/pure.ts',
      'src/hooks.ts',
      'src/components.ts',
      'src/components-rsc.ts',
      'src/cookies.ts',
    ],
    deps: contextDeps,
    typeEntry: false,
  })
);
