import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^react-router$/,
    /^react-router\//,
    /^gt-react$/,
    /^gt-react\//,
    /^gt-i18n$/,
    /^gt-i18n\//,
    /^generaltranslation$/,
  ],
  alwaysBundle: [/^generaltranslation\//],
};

const [, esmConfig] = createTsdownConfig(['src/index.ts'], deps);

export default defineConfig({
  ...esmConfig,
  clean: true,
  dts: true,
  deps: {
    onlyBundle: false,
    ...deps,
  },
});
