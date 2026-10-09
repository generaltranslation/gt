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
    /^vite$/,
    /^@generaltranslation\/compiler$/,
    // Kept as a bare import so the Vite plugin can replace it.
    /^gt-tanstack-start\/internal\/_config$/,
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

const entries: Record<string, string> = {
  'index.client': 'src/index.client.ts',
  'index.server': 'src/index.server.ts',
  server: 'src/server.ts',
  'plugin/vite': 'src/plugin/vite.ts',
  'internal/_config': 'src/internal/_config.ts',
};

export default defineConfig(
  Object.entries(entries).map(([name, entry], index) => {
    const [, esmConfig] = createTsdownConfig([entry], deps);
    return {
      ...esmConfig,
      entry: { [name]: entry },
      clean: index === 0,
      dts: true,
      deps: {
        onlyBundle: false,
        ...deps,
      },
    };
  })
);
