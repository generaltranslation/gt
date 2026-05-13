import { defineConfig } from 'tsdown';
import { createTsdownMinifiedDualFormatConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^@tanstack\/react-start$/,
    /^@tanstack\/react-start\//,
    /^@generaltranslation\/react-core$/,
    /^gt-react$/,
    /^gt-i18n$/,
    /^generaltranslation$/,
  ],
  alwaysBundle: [
    /^@generaltranslation\/react-core\//,
    /^gt-react\//,
    /^gt-i18n\//,
    /^generaltranslation\//,
  ],
};

export default defineConfig(
  createTsdownMinifiedDualFormatConfig({
    entries: ['src/index.ts'],
    deps,
  })
);
