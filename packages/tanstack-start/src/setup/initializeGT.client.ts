import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import type { SharedGTProviderProps } from 'gt-react';
import {
  config as pluginConfig,
  dictionary as pluginDictionary,
  loadDictionary as pluginLoadDictionary,
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

/** Whether the plugin's config routes by locale. */
export function isLocaleRoutingEnabled(): boolean {
  return localeRoutingEnabled;
}

/**
 * Initialize GT and its browser condition store from the pathname locale (with
 * localeRouting) or the locale cookie.
 */
function initialize(config: InitializeGTParams): void {
  const reload: SharedGTProviderProps['_reload'] = config.localeRouting
    ? ({ locale }) => {
        const destination = new URL(window.location.href);
        destination.pathname = getPathnameForLocale(
          window.location.pathname,
          locale
        );
        window.location.assign(destination.href);
      }
    : undefined;

  initializeReactGT(config);
  createOrUpdateBrowserConditionStore({
    ...config,
    _reload: reload,
    locale: determineLocaleClient(config),
  });
  clientReload = reload;
  localeRoutingEnabled = config.localeRouting === true;
  initialized = true;
}

/**
 * Initialize once from the Vite plugin's config. Without the plugin this is a
 * no-op.
 */
export function ensureInitialized(): void {
  if (initialized || !pluginConfig) return;
  initialize({
    ...pluginConfig,
    loadTranslations: pluginLoadTranslations,
    dictionary: pluginDictionary,
    loadDictionary: pluginLoadDictionary,
  });
}
