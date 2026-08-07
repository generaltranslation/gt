import { createUnplugin } from 'unplugin';
import { LOCALE_POLYFILLS } from './polyfills';
import { resolveLocales } from './resolveLocales';

export interface GtPolyfillsOptions {
  /** List of locales to polyfill */
  locales?: string[];
  /** GT config object */
  config?: { defaultLocale: string; locales: string[] } & Record<string, any>;
  /** Path to the gt config file */
  configFilePath?: string;
  /** Module ID of the entry point to inject into. If omitted, injects into the first module transformed. */
  entry?: string;
}

const gtPolyfillsPlugin = createUnplugin((options: GtPolyfillsOptions = {}) => {
  const { locales, config, configFilePath, entry } = options;

  const resolvedLocales = resolveLocales({ locales, config, configFilePath });

  // Build the import statements to prepend
  const localeImports = resolvedLocales.flatMap((locale) =>
    LOCALE_POLYFILLS.map(
      (localeData) => `import '${localeData}/${locale}';`
    )
  );

  const injectedCode = [
    `import 'gt-polyfills';`,
    ...localeImports,
    '',
  ].join('\n');

  let injected = false;

  return {
    name: 'gt-polyfills',
    enforce: 'pre' as const,

    transformInclude(id: string) {
      // If entry is specified, only match that
      if (entry) {
        return id.includes(entry);
      }
      // Otherwise match common entry patterns
      return /\.[jt]sx?$/.test(id);
    },

    transform(code: string, id: string) {
      // Only inject once
      if (injected) return;

      // If entry is specified, only inject into that file
      if (entry && !id.includes(entry)) return;

      // Skip node_modules
      if (id.includes('node_modules')) return;

      // Don't inject into files that already have gt-polyfills
      if (code.includes("'gt-polyfills'") || code.includes('"gt-polyfills"')) {
        return;
      }

      injected = true;

      return {
        code: injectedCode + code,
        map: null,
      };
    },
  };
});

export default gtPolyfillsPlugin;
export const vite = gtPolyfillsPlugin.vite;
export const webpack = gtPolyfillsPlugin.webpack;
export const rollup = gtPolyfillsPlugin.rollup;
export const esbuild = gtPolyfillsPlugin.esbuild;
export const rspack = gtPolyfillsPlugin.rspack;
