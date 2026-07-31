import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^vue$/,
    /^vue\//,
    /^generaltranslation$/,
    /^generaltranslation\//,
  ],
  alwaysBundle: [/^gt-i18n\/internal\/string$/],
};

const configs = createTsdownConfig(['src/index.ts'], deps).map((config) => ({
  ...config,
  outputOptions: {
    comments: {
      annotation: true,
      jsdoc: false,
      legal: true,
    },
  },
}));

export default defineConfig(configs);
