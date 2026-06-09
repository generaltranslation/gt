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

// The context.rsc entry reaches client components (GTProvider, LocaleSelector,
// T) through the context.server entrypoint, an intentional server-to-client
// boundary. Bundling that import would drop the 'use client' directive and
// silently break the boundary, so it is kept external and rewritten to the
// built context.server artifact for each format.
const contextServerImport = /[\\/]context\.server$/;

function externalizeContextServer(extension: '.cjs' | '.mjs') {
  return {
    name: 'externalize-context-server',
    resolveId(id: string) {
      if (contextServerImport.test(id)) {
        return { id: `./context.server${extension}`, external: true };
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
  'src/context.rsc.tsx',
  'src/context.types.ts',
  'src/context-rsc.ts',
  'src/browser.ts',
  'src/macros.ts',
];

export default defineConfig(
  entries.flatMap((entry, index) => {
    const entryDeps = entry.startsWith('src/context') ? contextDeps : deps;
    const isRscEntry = entry === 'src/context.rsc.tsx';
    const [cjsConfig, esmConfig] = createTsdownConfig([entry], entryDeps);

    return [
      {
        ...cjsConfig,
        ...(isRscEntry ? { plugins: [externalizeContextServer('.cjs')] } : {}),
        clean: index === 0,
        define: {
          'import.meta.env': '{}',
        },
      },
      {
        ...esmConfig,
        ...(isRscEntry ? { plugins: [externalizeContextServer('.mjs')] } : {}),
        deps: {
          onlyBundle: false,
          ...entryDeps,
        },
      },
    ];
  })
);
