import type { GTAstroRuntimeConfig, GTAstroRuntimeSettings } from '../types';

export const SERVER_CONFIG_MODULE_ID = 'virtual:gt-astro/config-server';

const RESOLVED_PREFIX = '\0';

type VirtualConfigPluginParams = {
  serverConfig: GTAstroRuntimeConfig;
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
 * Serves the virtual config module consumed by gt-astro/middleware on the
 * server. The client gets its (credential-stripped) config inlined into the
 * injected before-hydration script instead, so no gt-astro module has to
 * resolve virtual ids in the client bundle.
 */
export function createVirtualConfigPlugin({
  serverConfig,
  settings,
  loadTranslationsPath,
}: VirtualConfigPluginParams): MinimalVitePlugin {
  const loadTranslationsExport = loadTranslationsPath
    ? `export { loadTranslations } from ${JSON.stringify(
        loadTranslationsPath.replace(/\\/g, '/')
      )};`
    : 'export const loadTranslations = undefined;';

  const serverModule = [
    `export const config = ${JSON.stringify(serverConfig)};`,
    `export const settings = ${JSON.stringify(settings)};`,
    loadTranslationsExport,
  ].join('\n');

  return {
    name: 'gt-astro:config',
    resolveId(id: string) {
      if (id === SERVER_CONFIG_MODULE_ID) return RESOLVED_PREFIX + id;
      return undefined;
    },
    load(id: string) {
      if (id === RESOLVED_PREFIX + SERVER_CONFIG_MODULE_ID) return serverModule;
      return undefined;
    },
  };
}
