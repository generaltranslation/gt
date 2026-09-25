import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import type { SharedGTProviderProps } from 'gt-react';
import { determineLocaleClient } from '../functions/parseLocale';
import { getPathnameForLocale } from '../functions/localeRouting';
import type { InitializeGTParams } from '../types/InitializeGTParams';

let clientReload: SharedGTProviderProps['_reload'];

export function getClientReload(): SharedGTProviderProps['_reload'] {
  return clientReload;
}

/** Initialize GT and its browser condition store from the locale cookie. */
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
}
