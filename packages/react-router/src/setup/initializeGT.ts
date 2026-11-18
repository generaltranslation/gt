import type { GTConfig } from 'gt-i18n/internal/types';
import { initializeGT as initializeReactGT } from 'gt-react';

let localeRouting = false;

/** Whether URLs carry the locale, as set by the last initializeGT call. */
export function isLocaleRoutingEnabled(): boolean {
  return localeRouting;
}

/** Initialize GT for a React Router app. */
export function initializeGT(
  config: Parameters<typeof initializeReactGT>[0] &
    Pick<GTConfig, 'localeRouting'>
): void {
  initializeReactGT(config);
  localeRouting = config.localeRouting === true;
}
