import {
  createOrUpdateBrowserConditionStore,
  initializeGT as initializeReactGT,
} from 'gt-react';
import { determineLocaleClient } from '../functions/parseLocale';

type InitializeGTParams = Parameters<typeof initializeReactGT>[0];

/** Initialize GT and its browser condition store from the locale cookie. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);
  createOrUpdateBrowserConditionStore({
    ...config,
    locale: determineLocaleClient(config),
  });
}
