import { getRuntimeEnvironment } from '../utils/getRuntimeEnvironment';
import type { I18nConfig } from './I18nConfig';
import { getI18nConfig } from './singleton-operations';

/**
 * Returns true when development hot reload runtime translation requests can
 * run: in development, with an API key and a projectId. A function rather
 * than an I18nConfig method, so production bundles, which call it only
 * behind a `process.env.NODE_ENV` check, leave it out.
 */
export function isDevHotReloadEnabled(
  config: I18nConfig = getI18nConfig()
): boolean {
  const { _disableDevHotReload, apiKey, projectId, runtimeUrl } =
    config.getRuntimeConfig();
  return (
    !_disableDevHotReload &&
    !!apiKey &&
    !!projectId &&
    runtimeUrl !== null &&
    runtimeUrl !== '' &&
    getRuntimeEnvironment() === 'development'
  );
}
