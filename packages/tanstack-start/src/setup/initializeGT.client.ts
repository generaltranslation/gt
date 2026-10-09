import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import type { SharedGTProviderProps } from 'gt-react';
import {
  config as pluginConfig,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
import { determineLocaleClient } from '../functions/parseLocale';
import { getPathnameForLocale } from '../functions/localeRouting';
import type { InitializeGTParams } from '../types/InitializeGTParams';

let clientReload: SharedGTProviderProps['_reload'];
let initialized = false;
let localeRoutingEnabled = false;

export function getClientReload(): SharedGTProviderProps['_reload'] {
  return clientReload;
}

/** Whether the initialized config, manual or from the plugin, routes by locale. */
export function isLocaleRoutingEnabled(): boolean {
  return localeRoutingEnabled;
}

/**
 * Initialize GT and its browser condition store from the pathname locale (with
 * localeRouting) or the locale cookie.
 */
export function initializeGT(config: InitializeGTParams): void {
  const browserConfig =
    config.localeRouting && !config._reload
      ? {
          ...config,
          _reload: ({ locale }: { locale: string }) => {
            const pathname = getPathnameForLocale(
              window.location.pathname,
              locale
            );
            const destination = new URL(window.location.href);
            destination.pathname = pathname;
            window.location.assign(destination.href);
          },
        }
      : config;

  initializeReactGT(config);
  createOrUpdateBrowserConditionStore({
    ...browserConfig,
    locale: determineLocaleClient(config),
  });
  clientReload = browserConfig._reload;
  localeRoutingEnabled = config.localeRouting === true;
  initialized = true;
}

/**
 * Initialize from the Vite plugin's config unless the app already called
 * initializeGT(). Without the plugin this is a no-op.
 */
export function ensureInitialized(): void {
  if (initialized || !pluginConfig) return;
  initializeGT({ ...pluginConfig, loadTranslations: pluginLoadTranslations });
}
