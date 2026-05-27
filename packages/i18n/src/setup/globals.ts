import { evaluateGTServicesEnabled } from './evaluateGTServicesEnabled';
import type { GTServicesSetupParams } from './types';

declare global {
  var __generaltranslation: {
    renderStrategy?: 'SPA' | 'server-render';
    gtServicesEnabled?: boolean;
  };
}

const globalState = (globalThis.__generaltranslation ??= {});

/**
 * Evaluate whether GT services are enabled and persist the result on the global object.
 */
export function setupGTServicesEnabled(config: GTServicesSetupParams): void {
  globalState.gtServicesEnabled = evaluateGTServicesEnabled(config);
}

/**
 * Returns true if GT services are enabled.
 */
export function getGTServicesEnabled(): boolean {
  if (globalState.gtServicesEnabled === undefined) {
    throw new Error(
      'Cannot read gtServicesEnabled. GT has not been initialized.'
    );
  }
  return globalState.gtServicesEnabled;
}
