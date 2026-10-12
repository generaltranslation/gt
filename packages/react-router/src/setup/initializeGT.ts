import { initializeGT as initializeReactGT } from 'gt-react';
import type { InitializeGTParams } from '../types/InitializeGTParams';

let localeRouting = false;

/** Whether URLs carry the locale, as set by the last initializeGT call. */
export function isLocaleRoutingEnabled(): boolean {
  return localeRouting;
}

/** Initialize GT for a React Router app. */
export function initializeGT(config: InitializeGTParams): void {
  initializeReactGT(config);
  localeRouting = config.localeRouting === true;
}
