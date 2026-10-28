import { defineConfig } from 'tsdown';
import { createTsdownConfig, withPackageChecks } from '../../tsdown.preset.mts';

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
    // Kept as bare imports so the Vite plugin can replace them.
    /^gt-tanstack-start\/internal\/(?:_config|_compat-config|localeRouting)$/,
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
  'plugin/vite': 'src/plugin/vite.ts',
  'internal/_config': 'src/internal/_config.ts',
  'internal/_compat-config': 'src/internal/_compat-config.ts',
  'internal/localeRouting': 'src/internal/localeRouting.ts',
  'internal/localeRouting.enabled': 'src/internal/localeRouting.enabled.ts',
  'internal/localeRouting.disabled': 'src/internal/localeRouting.disabled.ts',
};

export default defineConfig(
  withPackageChecks(
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
    }),
    { profile: 'esm-only' }
  )
);
