import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^@generaltranslation\/react-core$/,
  ],
  alwaysBundle: [
    /^@generaltranslation\/format\//,
    /^@generaltranslation\/react-core\//,
    /^generaltranslation\//,
    /^gt-i18n\//,
  ],
};

const configs = createTsdownConfig(
  [
    'src/index.ts',
    'src/internal.ts',
    'src/client.ts',
    'src/browser.ts',
    'src/macros.ts',
  ],
  deps
);

export default defineConfig([
  {
    ...configs[0],
    define: {
      'import.meta.env': '{}',
    },
  },
  {
    ...configs[1],
    deps: {
      onlyBundle: false,
      ...deps,
    },
  },
]);
