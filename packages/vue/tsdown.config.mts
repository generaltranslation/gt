import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^vue$/,
    /^vue\//,
    /^generaltranslation$/,
    /^generaltranslation\//,
    /^gt-i18n$/,
    /^gt-i18n\//,
  ],
};

const configs = createTsdownConfig(['src/index.ts'], deps).map((config) => ({
  ...config,
  // Keep declared runtime dependencies external in both formats. The shared
  // preset only applies this policy to CJS, while modern consumers load ESM.
  deps: { onlyBundle: false, ...deps },
  outputOptions: {
    comments: {
      annotation: true,
      jsdoc: false,
      legal: true,
    },
  },
}));

export default defineConfig(configs);
