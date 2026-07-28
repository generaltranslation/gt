import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^@tanstack\/react-start$/,
    /^@tanstack\/react-start\//,
    /^@generaltranslation\/react-core$/,
    /^@generaltranslation\/react-core\//,
    /^gt-react$/,
    /^gt-react\//,
    /^gt-i18n$/,
    /^gt-i18n\//,
    /^generaltranslation$/,
  ],
  alwaysBundle: [/^generaltranslation\//],
};

const entries = ['src/index.client.ts', 'src/index.server.ts', 'src/server.ts'];

export default defineConfig(
  entries.map((entry, index) => {
    const [, esmConfig] = createTsdownConfig([entry], deps);
    return {
      ...esmConfig,
      clean: index === 0,
      dts: true,
      deps: {
        onlyBundle: false,
        ...deps,
      },
    };
  })
);
