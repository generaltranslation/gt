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
    // Self-referencing subpaths (e.g. the locale selector client boundary)
    // must stay external so their 'use client' directive survives.
    /^gt-react\//,
  ],
  alwaysBundle: [/^@generaltranslation\/format\//, /^generaltranslation\//],
};

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
    const entryDeps = entry.startsWith('src/context') ? contextDeps : deps;
    const [cjsConfig, esmConfig] = createTsdownConfig([entry], entryDeps);

    return [
      {
        ...cjsConfig,
        clean: index === 0,
        define: {
          'import.meta.env': '{}',
        },
      },
      {
        ...esmConfig,
        deps: {
          onlyBundle: false,
          ...entryDeps,
        },
      },
    ];
  })
);
