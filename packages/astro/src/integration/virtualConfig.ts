import type { GTAstroRuntimeConfig, GTAstroRuntimeSettings } from '../types';

export const SERVER_CONFIG_MODULE_ID = 'virtual:gt-astro/config-server';
export const CLIENT_CONFIG_MODULE_ID = 'virtual:gt-astro/config-client';

const RESOLVED_PREFIX = '\0';

type VirtualConfigPluginParams = {
  serverConfig: GTAstroRuntimeConfig;
  clientConfig: GTAstroRuntimeConfig;
  settings: GTAstroRuntimeSettings;
  /** Absolute path to the app's loadTranslations module, if any. */
  loadTranslationsPath?: string;
};

/**
 * Minimal structural Vite plugin type, so gt-astro doesn't need a dependency
 * on Vite for types alone.
 */
export type MinimalVitePlugin = {
  name: string;
  enforce?: 'pre' | 'post';
  resolveId?: (id: string) => string | undefined;
  load?: (id: string) => string | undefined;
};

/**
 * Serves the virtual config modules consumed by gt-astro/middleware (server)
 * and gt-astro/client (browser). Credentials are split so the API key never
 * reaches a client bundle.
 */
export function createVirtualConfigPlugin({
  serverConfig,
  clientConfig,
  settings,
  loadTranslationsPath,
}: VirtualConfigPluginParams): MinimalVitePlugin {
  const loadTranslationsExport = loadTranslationsPath
    ? `export { loadTranslations } from ${JSON.stringify(
        loadTranslationsPath.replace(/\\/g, '/')
      )};`
    : 'export const loadTranslations = undefined;';

  const modules: Record<string, string> = {
    [SERVER_CONFIG_MODULE_ID]: [
      `export const config = ${JSON.stringify(serverConfig)};`,
      `export const settings = ${JSON.stringify(settings)};`,
      loadTranslationsExport,
    ].join('\n'),
    [CLIENT_CONFIG_MODULE_ID]: [
      `export const config = ${JSON.stringify(clientConfig)};`,
      loadTranslationsExport,
    ].join('\n'),
  };

  return {
    name: 'gt-astro:config',
    resolveId(id: string) {
      if (id in modules) return RESOLVED_PREFIX + id;
      return undefined;
    },
    load(id: string) {
      if (!id.startsWith(RESOLVED_PREFIX)) return undefined;
      return modules[id.slice(RESOLVED_PREFIX.length)];
    },
  };
}
