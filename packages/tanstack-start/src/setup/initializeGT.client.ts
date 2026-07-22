import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import { determineLocaleClient } from '../functions/parseLocale';
import { getPathnameForLocale } from '../functions/localeRouting';
import type { InitializeGTParams } from '../types';

/** Initialize GT and its browser condition store from the locale cookie. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);
  const browserConfig = config.localeRouting
    ? {
        ...config,
        _reload: ({ locale }: { locale: string }) => {
          const pathname = getPathnameForLocale(
            window.location.pathname,
            locale
          );
          window.location.assign(
            `${pathname}${window.location.search}${window.location.hash}`
          );
        },
      }
    : config;

  createOrUpdateBrowserConditionStore({
    ...browserConfig,
    locale: determineLocaleClient(config),
  });
}
