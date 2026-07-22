import { initializeGT as initializeReactGT } from 'gt-react';
import { createOrUpdateBrowserConditionStore } from 'gt-react/internal';
import { parseLocale } from '../functions/parseLocale';

type InitializeGTParams = Parameters<typeof initializeReactGT>[0];

/** Initialize GT and its browser condition store from the locale cookie. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);
  createOrUpdateBrowserConditionStore({
    ...config,
    locale: parseLocale(),
  });
}
