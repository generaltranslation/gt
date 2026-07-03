import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^vue$/,
    /^vue\//,
    /^@vue\//,
    /^gt-i18n$/,
    /^gt-i18n\//,
    /^generaltranslation$/,
  ],
  alwaysBundle: [/^generaltranslation\//],
};

export default defineConfig(
  createTsdownConfig(['src/index.ts'], deps).map((config, index) => ({
    ...config,
    clean: index === 0,
    define: {
      'import.meta.env': '{}',
    },
    deps: {
      onlyBundle: false,
      ...deps,
    },
  }))
);
