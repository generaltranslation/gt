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

const contextDeps = {
  neverBundle: [
    ...deps.neverBundle,
    /^@generaltranslation\/react-core\//,
    /^gt-i18n$/,
    /^gt-i18n\//,
  ],
  alwaysBundle: [/^@generaltranslation\/format\//, /^generaltranslation\//],
};

// The locale selector client boundary must stay a separate build artifact:
// bundling a 'use client' module into another entry drops the directive. The
// context entries resolve the relative import to the built
// locale-selector.client artifact for each format and keep it external.
const localeSelectorClientImport = /[\\/]locale-selector\.client$/;

function externalizeLocaleSelectorClient(extension: '.cjs' | '.mjs') {
  return {
    name: 'externalize-locale-selector-client',
    resolveId(id: string) {
      if (localeSelectorClientImport.test(id)) {
        return { id: `./locale-selector.client${extension}`, external: true };
      }
      return null;
    },
  };
}

const entries = [
  'src/index.ts',
  'src/internal.ts',
  'src/client.ts',
  'src/context.client.ts',
  'src/context.server.ts',
  'src/context.types.ts',
  'src/context-rsc.ts',
  'src/locale-selector.client.ts',
  'src/browser.ts',
  'src/macros.ts',
];

export default defineConfig(
  entries.flatMap((entry, index) => {
    const isContextEntry = entry.startsWith('src/context');
    const entryDeps = isContextEntry ? contextDeps : deps;
    const [cjsConfig, esmConfig] = createTsdownConfig([entry], entryDeps);

    return [
      {
        ...cjsConfig,
        ...(isContextEntry
          ? { plugins: [externalizeLocaleSelectorClient('.cjs')] }
          : {}),
        clean: index === 0,
        define: {
          'import.meta.env': '{}',
        },
      },
      {
        ...esmConfig,
        ...(isContextEntry
          ? { plugins: [externalizeLocaleSelectorClient('.mjs')] }
          : {}),
        deps: {
          onlyBundle: false,
          ...entryDeps,
        },
      },
    ];
  })
);
