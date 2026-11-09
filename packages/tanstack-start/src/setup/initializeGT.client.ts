import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import type { SharedGTProviderProps } from 'gt-react';
import {
  getI18nConfig,
  initializeReactI18nCache,
} from '@generaltranslation/react-core/pure';
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

  // gt-react only creates a client i18nCache in development. TanStack Start
  // also needs one in production: route loaders and getGT(), getMessages(),
  // and getTranslations() run in the browser during client-side navigation.
  if (process.env.NODE_ENV === 'production') {
    initializeReactI18nCache({
      cacheExpiryTime: null,
      ...config,
      projectId: config.projectId || getI18nConfig().getProjectId(),
    });
  }

  createOrUpdateBrowserConditionStore({
    ...browserConfig,
    locale: determineLocaleClient(config),
  });
  clientReload = browserConfig._reload;
}
