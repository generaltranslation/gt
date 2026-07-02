// Internal config plumbing for the integration: gt.config.json loading and
// the virtual module that carries server config to the middleware.
import fs from 'node:fs';
import type {
  GTAstroFileConfig,
  GTAstroRuntimeConfig,
  GTAstroRuntimeSettings,
} from './types';

export const SERVER_CONFIG_MODULE_ID = 'virtual:gt-astro/config-server';

const RESOLVED_PREFIX = '\0';

/**
 * Reads gt.config.json from disk. Returns an empty config when the file is
 * missing so apps can configure gt-astro entirely via integration options.
 */
export function loadGTConfig(gtConfigPath: string): {
  gtConfig: GTAstroFileConfig;
  exists: boolean;
} {
  if (!fs.existsSync(gtConfigPath)) {
    return { gtConfig: {}, exists: false };
  }
  const raw = fs.readFileSync(gtConfigPath, 'utf-8');
  return { gtConfig: JSON.parse(raw) as GTAstroFileConfig, exists: true };
}

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
  const serverModule = [
    `export const config = ${JSON.stringify(serverConfig)};`,
    `export const settings = ${JSON.stringify(settings)};`,
    loadTranslationsExport(loadTranslationsPath),
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

function loadTranslationsExport(loadTranslationsPath?: string): string {
  return loadTranslationsPath
    ? `export { loadTranslations } from ${JSON.stringify(
        loadTranslationsPath.replace(/\\/g, '/')
      )};`
    : 'export const loadTranslations = undefined;';
}
