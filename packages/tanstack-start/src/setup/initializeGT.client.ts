import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import type { SharedGTProviderProps } from 'gt-react';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import { createGlobalSingleton } from 'gt-i18n/internal';
import {
  config as pluginConfig,
  dictionary as pluginDictionary,
  loadDictionary as pluginLoadDictionary,
  loadTranslations as pluginLoadTranslations,
} from 'gt-tanstack-start/internal/_config';
import { determineLocaleClient } from '../functions/parseLocale';
import { getPathnameForLocale } from '../functions/localeRouting';
import type { InitializeGTParams } from '../types/InitializeGTParams';

type ClientSetup = {
  reload: SharedGTProviderProps['_reload'];
  localeRouting: boolean;
};

const clientSetup = createGlobalSingleton<ClientSetup>({
  namespace: 'tanstackStart',
  key: 'clientSetup',
  source: 'gt-tanstack-start',
  notInitialized: () =>
    createDiagnosticMessage({
      source: 'gt-tanstack-start',
      severity: 'Error',
      whatHappened: 'Cannot read GT browser setup before initialization',
      why: 'the gtTanstackStart() Vite plugin is not registered, so GT has no config',
      fix: "Add gtTanstackStart() from 'gt-tanstack-start/plugin/vite' to the plugins in your Vite config",
    }),
});

export function getClientReload(): SharedGTProviderProps['_reload'] {
  return clientSetup.isInitialized() ? clientSetup.get().reload : undefined;
}

/** Whether the plugin's config routes by locale. */
export function isLocaleRoutingEnabled(): boolean {
  return clientSetup.isInitialized() && clientSetup.get().localeRouting;
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
  clientSetup.set({ reload, localeRouting: config.localeRouting === true });
}

/**
 * Initialize once from the Vite plugin's config. Without the plugin this is a
 * no-op.
 */
export function ensureInitialized(): void {
  if (clientSetup.isInitialized() || !pluginConfig) return;
  initialize({
    ...pluginConfig,
    loadTranslations: pluginLoadTranslations,
    dictionary: pluginDictionary,
    loadDictionary: pluginLoadDictionary,
  });
}
