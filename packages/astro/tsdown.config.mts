import { defineConfig } from 'tsdown';
import { createTsdownConfig } from '../../tsdown.preset.mts';

const deps = {
  neverBundle: [
    /^react$/,
    /^react\//,
    /^react-dom$/,
    /^react-dom\//,
    /^astro$/,
    /^astro\//,
    /^node:/,
    /^virtual:gt-astro\//,
    /^@generaltranslation\/compiler$/,
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

const entries = [
  'src/index.ts',
  'src/middleware.ts',
  'src/server.ts',
  'src/react.ts',
  'src/client.ts',
];

export default defineConfig(
  entries.flatMap((entry, index) => {
    const [cjsConfig, esmConfig] = createTsdownConfig([entry], deps);
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
          ...deps,
        },
      },
    ];
  })
);
